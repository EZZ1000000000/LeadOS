/**
 * LeadOS — ADDITIVE-ONLY schema sync v3 (Neon production): جداول Browser Runtime + JinaMetric.
 * طلب §1..§23: BrowserRuntime / BrowserSessionState / BrowserCheckpoint / BrowserEvent / JinaMetric
 *
 * SAFETY CONTRACT (hard rules):
 *   - NO DROP of anything. Ever.
 *   - بيانات الجوالات والجداول الموجودة: UNTOUCHED.
 *   - Everything idempotent (IF NOT EXISTS / duplicate guards) — safe to re-run.
 *
 * Run: node scripts/sync-neon-additive-v3.js
 */
const fs = require("fs");

let url = "";
for (const line of fs.readFileSync("/home/z/my-project/.env.prod-runtime", "utf8").split("\n")) {
  const m = line.match(/^DATABASE_URL=(.*)$/);
  if (m) { url = m[1].trim().replace(/^"|"$/g, ""); break; }
}
if (!url.startsWith("postgres")) { console.error("no DATABASE_URL"); process.exit(1); }
const { Client } = require("pg");

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function q(sql) { await client.query(sql); }
async function tableExists(name) {
  const r = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`, [name]);
  return r.rowCount > 0;
}
async function colExists(table, col) {
  const r = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`, [table, col]);
  return r.rowCount > 0;
}
async function indexExists(name) {
  const r = await client.query(`SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname=$1`, [name]);
  return r.rowCount > 0;
}
async function fk(constraintName, ddl) {
  const r = await client.query(`SELECT 1 FROM pg_constraint WHERE conname=$1`, [constraintName]);
  if (r.rowCount > 0) { console.log(`  = FK ${constraintName} already present`); return; }
  await q(ddl);
  console.log(`  + FK ${constraintName} added`);
}
async function ensureIndex(name, ddl) {
  if (await indexExists(name)) { console.log(`  = index ${name} already present`); return; }
  await q(ddl);
  console.log(`  + index ${name} added`);
}

const TABLES = {
  BrowserRuntime: `CREATE TABLE IF NOT EXISTS "BrowserRuntime" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "browserId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "runnerId" TEXT,
    "ghRunId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'STARTING',
    "currentTask" TEXT,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkpointAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closeReason" TEXT,
    "lastError" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BrowserRuntime_pkey" PRIMARY KEY ("id")
  )`,
  BrowserSessionState: `CREATE TABLE IF NOT EXISTS "BrowserSessionState" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "browserProfileId" TEXT NOT NULL,
    "sessionStateVersion" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'NEEDS_SESSION',
    "storageCipher" TEXT,
    "storageMeta" JSONB,
    "lastValidatedAt" TIMESTAMP(3),
    "lastSuccessfulUse" TIMESTAMP(3),
    "generation" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BrowserSessionState_pkey" PRIMARY KEY ("id")
  )`,
  BrowserCheckpoint: `CREATE TABLE IF NOT EXISTS "BrowserCheckpoint" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "browserId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "jobId" TEXT,
    "ghRunId" TEXT,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "step" TEXT NOT NULL,
    "cursor" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restoredAt" TIMESTAMP(3),
    CONSTRAINT "BrowserCheckpoint_pkey" PRIMARY KEY ("id")
  )`,
  BrowserEvent: `CREATE TABLE IF NOT EXISTS "BrowserEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "browserId" TEXT,
    "platform" TEXT NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "ghRunId" TEXT,
    "type" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BrowserEvent_pkey" PRIMARY KEY ("id")
  )`,
  JinaMetric: `CREATE TABLE IF NOT EXISTS "JinaMetric" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "timeoutCount" INTEGER NOT NULL DEFAULT 0,
    "totalLatencyMs" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JinaMetric_pkey" PRIMARY KEY ("id")
  )`,
};

const INDEXES = [
  ["BrowserRuntime_platform_status_idx", `CREATE INDEX IF NOT EXISTS "BrowserRuntime_platform_status_idx" ON "BrowserRuntime"("platform", "status")`],
  ["BrowserRuntime_workspaceId_platform_status_idx", `CREATE INDEX IF NOT EXISTS "BrowserRuntime_workspaceId_platform_status_idx" ON "BrowserRuntime"("workspaceId", "platform", "status")`],
  ["BrowserRuntime_status_lastHeartbeat_idx", `CREATE INDEX IF NOT EXISTS "BrowserRuntime_status_lastHeartbeat_idx" ON "BrowserRuntime"("status", "lastHeartbeat")`],
  ["BrowserSessionState_platform_status_idx", `CREATE INDEX IF NOT EXISTS "BrowserSessionState_platform_status_idx" ON "BrowserSessionState"("platform", "status")`],
  ["BrowserCheckpoint_browserId_status_idx", `CREATE INDEX IF NOT EXISTS "BrowserCheckpoint_browserId_status_idx" ON "BrowserCheckpoint"("browserId", "status")`],
  ["BrowserCheckpoint_platform_generation_idx", `CREATE INDEX IF NOT EXISTS "BrowserCheckpoint_platform_generation_idx" ON "BrowserCheckpoint"("platform", "generation")`],
  ["BrowserEvent_platform_createdAt_idx", `CREATE INDEX IF NOT EXISTS "BrowserEvent_platform_createdAt_idx" ON "BrowserEvent"("platform", "createdAt")`],
  ["BrowserEvent_type_createdAt_idx", `CREATE INDEX IF NOT EXISTS "BrowserEvent_type_createdAt_idx" ON "BrowserEvent"("type", "createdAt")`],
];

const UNIQUES = [
  ["BrowserRuntime_browserId_key", `CREATE UNIQUE INDEX IF NOT EXISTS "BrowserRuntime_browserId_key" ON "BrowserRuntime"("browserId")`],
  ["BrowserSessionState_workspaceId_platform_browserProfileId_key", `CREATE UNIQUE INDEX IF NOT EXISTS "BrowserSessionState_workspaceId_platform_browserProfileId_key" ON "BrowserSessionState"("workspaceId", "platform", "browserProfileId")`],
  ["JinaMetric_workspaceId_day_key", `CREATE UNIQUE INDEX IF NOT EXISTS "JinaMetric_workspaceId_day_key" ON "JinaMetric"("workspaceId", "day")`],
];

const FKS = [
  ["BrowserRuntime_workspaceId_fkey", `ALTER TABLE "BrowserRuntime" ADD CONSTRAINT "BrowserRuntime_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
  ["BrowserSessionState_workspaceId_fkey", `ALTER TABLE "BrowserSessionState" ADD CONSTRAINT "BrowserSessionState_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
  ["BrowserCheckpoint_workspaceId_fkey", `ALTER TABLE "BrowserCheckpoint" ADD CONSTRAINT "BrowserCheckpoint_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
  ["BrowserEvent_workspaceId_fkey", `ALTER TABLE "BrowserEvent" ADD CONSTRAINT "BrowserEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
  ["JinaMetric_workspaceId_fkey", `ALTER TABLE "JinaMetric" ADD CONSTRAINT "JinaMetric_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
];

async function main() {
  await client.connect();
  const before = await client.query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`);
  console.log(`tables before: ${before.rows[0].n}`);

  for (const [name, ddl] of Object.entries(TABLES)) {
    if (await tableExists(name)) { console.log(`= table ${name} already present`); continue; }
    await q(ddl);
    console.log(`+ table ${name} created`);
  }
  for (const [name, ddl] of UNIQUES) await ensureIndex(name, ddl);
  for (const [name, ddl] of INDEXES) await ensureIndex(name, ddl);
  for (const [name, ddl] of FKS) await fk(name, ddl);

  const after = await client.query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`);
  console.log(`tables after: ${after.rows[0].n}`);

  // POST-CHECK: بيانات الجوالات سليمة — لا DROP حصل أصلًا لكن نتوثق
  const leads = await client.query(`SELECT count(*)::int AS n FROM "Lead"`);
  const phones = await client.query(`SELECT count(*)::int AS n FROM "Lead" WHERE "phone" IS NOT NULL AND "phone" <> ''`);
  const ws = await client.query(`SELECT "id", "name" FROM "Workspace" WHERE "isActive" = true LIMIT 3`);
  console.log(`POST-CHECK: leads=${leads.rows[0].n} withPhone=${phones.rows[0].n} activeWorkspaces=${ws.rows.length}`);
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
