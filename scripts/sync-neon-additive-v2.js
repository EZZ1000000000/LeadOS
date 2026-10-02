/**
 * LeadOS — ADDITIVE-ONLY schema sync v2 (Neon production).
 * Fixes dashboard 500s: missing Lead columns + 9 missing tables + Conversation cols + JobType enum values.
 *
 * SAFETY CONTRACT (hard rules):
 *   - NO DROP of anything. Ever.
 *   - Lead.phone / phoneCountry / phoneSource and their index: UNTOUCHED.
 *   - Everything idempotent (IF NOT EXISTS / duplicate guards) — safe to re-run.
 *   - ALTER TYPE ADD VALUE runs outside any transaction (Postgres requirement).
 *
 * Run: DATABASE_URL=postgres://... node scripts/sync-neon-additive-v2.js
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

async function q(sql) {
  await client.query(sql);
}
async function enumHas(type, value) {
  const r = await client.query(`SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname=$1 AND e.enumlabel=$2`, [type, value]);
  return r.rowCount > 0;
}
async function addEnumValue(type, value) {
  if (await enumHas(type, value)) { console.log(`  = ${type}.${value} already present`); return; }
  await q(`ALTER TYPE "${type}" ADD VALUE '${value}'`);
  console.log(`  + ${type}.${value} added`);
}
async function fk(constraintName, ddl) {
  const r = await client.query(`SELECT 1 FROM pg_constraint WHERE conname=$1`, [constraintName]);
  if (r.rowCount > 0) { console.log(`  = FK ${constraintName} already present`); return; }
  await q(ddl);
  console.log(`  + FK ${constraintName} added`);
}

const TABLES = {
  Sequence: `CREATE TABLE IF NOT EXISTS "Sequence" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'NURTURE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "targetStatuses" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "conversationId" TEXT,
    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
  )`,
  SequenceStep: `CREATE TABLE IF NOT EXISTS "SequenceStep" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "channel" TEXT NOT NULL DEFAULT 'TASK',
    "template" TEXT NOT NULL,
    "waitHours" INTEGER NOT NULL DEFAULT 72,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "SequenceStep_pkey" PRIMARY KEY ("id")
  )`,
  SequenceEnrollment: `CREATE TABLE IF NOT EXISTS "SequenceEnrollment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "nextStepAt" TIMESTAMP(3),
    "lastStepAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "conversationId" TEXT,
    CONSTRAINT "SequenceEnrollment_pkey" PRIMARY KEY ("id")
  )`,
  AbExperiment: `CREATE TABLE IF NOT EXISTS "AbExperiment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variants" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "conversationId" TEXT,
    CONSTRAINT "AbExperiment_pkey" PRIMARY KEY ("id")
  )`,
  EvolutionProposal: `CREATE TABLE IF NOT EXISTS "EvolutionProposal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "plan" JSONB NOT NULL,
    "impact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT,
    CONSTRAINT "EvolutionProposal_pkey" PRIMARY KEY ("id")
  )`,
  TacticStat: `CREATE TABLE IF NOT EXISTS "TacticStat" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "tacticId" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "lastUsedAt" TIMESTAMP(3),
    "lastWinAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "conversationId" TEXT,
    CONSTRAINT "TacticStat_pkey" PRIMARY KEY ("id")
  )`,
  SkillStat: `CREATE TABLE IF NOT EXISTS "SkillStat" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "results" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "lastUsedAt" TIMESTAMP(3),
    "lastLeadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SkillStat_pkey" PRIMARY KEY ("id")
  )`,
  SkillLesson: `CREATE TABLE IF NOT EXISTS "SkillLesson" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "niche" TEXT,
    "leads" INTEGER NOT NULL DEFAULT 1,
    "quality" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'learned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    CONSTRAINT "SkillLesson_pkey" PRIMARY KEY ("id")
  )`,
  GitSkill: `CREATE TABLE IF NOT EXISTS "GitSkill" (
    "id" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '',
    "relevance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "leadCount" INTEGER NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GitSkill_pkey" PRIMARY KEY ("id")
  )`,
};

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS "Sequence_workspaceId_enabled_kind_idx" ON "Sequence"("workspaceId", "enabled", "kind")`,
  `CREATE INDEX IF NOT EXISTS "SequenceStep_sequenceId_order_idx" ON "SequenceStep"("sequenceId", "order")`,
  `CREATE INDEX IF NOT EXISTS "SequenceEnrollment_workspaceId_status_nextStepAt_idx" ON "SequenceEnrollment"("workspaceId", "status", "nextStepAt")`,
  `CREATE INDEX IF NOT EXISTS "SequenceEnrollment_leadId_idx" ON "SequenceEnrollment"("leadId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "SequenceEnrollment_sequenceId_leadId_key" ON "SequenceEnrollment"("sequenceId", "leadId")`,
  `CREATE INDEX IF NOT EXISTS "AbExperiment_workspaceId_status_idx" ON "AbExperiment"("workspaceId", "status")`,
  `CREATE INDEX IF NOT EXISTS "EvolutionProposal_workspaceId_status_createdAt_idx" ON "EvolutionProposal"("workspaceId", "status", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "TacticStat_workspaceId_family_idx" ON "TacticStat"("workspaceId", "family")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "TacticStat_workspaceId_family_tacticId_key" ON "TacticStat"("workspaceId", "family", "tacticId")`,
  `CREATE INDEX IF NOT EXISTS "SkillStat_platform_idx" ON "SkillStat"("platform")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "SkillStat_workspaceId_platform_key" ON "SkillStat"("workspaceId", "platform")`,
  `CREATE INDEX IF NOT EXISTS "SkillLesson_platform_quality_idx" ON "SkillLesson"("platform", "quality")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "SkillLesson_workspaceId_platform_query_key" ON "SkillLesson"("workspaceId", "platform", "query")`,
  `CREATE INDEX IF NOT EXISTS "GitSkill_relevance_idx" ON "GitSkill"("relevance")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "GitSkill_repo_path_key" ON "GitSkill"("repo", "path")`,
  `CREATE INDEX IF NOT EXISTS "Lead_workspaceId_sourcePlatform_idx" ON "Lead"("workspaceId", "sourcePlatform")`,
  `CREATE INDEX IF NOT EXISTS "Lead_workspaceId_intentSignal_idx" ON "Lead"("workspaceId", "intentSignal")`,
];

const FKS = [
  ["Sequence_workspaceId_fkey", `ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
  ["Sequence_conversationId_fkey", `ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE`],
  ["SequenceStep_sequenceId_fkey", `ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
  ["SequenceEnrollment_sequenceId_fkey", `ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
  ["SequenceEnrollment_leadId_fkey", `ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
  ["SequenceEnrollment_conversationId_fkey", `ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE`],
  ["AbExperiment_workspaceId_fkey", `ALTER TABLE "AbExperiment" ADD CONSTRAINT "AbExperiment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
  ["AbExperiment_conversationId_fkey", `ALTER TABLE "AbExperiment" ADD CONSTRAINT "AbExperiment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE`],
  ["EvolutionProposal_workspaceId_fkey", `ALTER TABLE "EvolutionProposal" ADD CONSTRAINT "EvolutionProposal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
  ["EvolutionProposal_conversationId_fkey", `ALTER TABLE "EvolutionProposal" ADD CONSTRAINT "EvolutionProposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE`],
  ["PlatformAccount_workspaceId_fkey", `ALTER TABLE "PlatformAccount" ADD CONSTRAINT "PlatformAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
  ["PlatformAccount_conversationId_fkey", `ALTER TABLE "PlatformAccount" ADD CONSTRAINT "PlatformAccount_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE`],
  ["TacticStat_workspaceId_fkey", `ALTER TABLE "TacticStat" ADD CONSTRAINT "TacticStat_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
  ["TacticStat_conversationId_fkey", `ALTER TABLE "TacticStat" ADD CONSTRAINT "TacticStat_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE`],
  ["SkillStat_workspaceId_fkey", `ALTER TABLE "SkillStat" ADD CONSTRAINT "SkillStat_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
  ["SkillLesson_workspaceId_fkey", `ALTER TABLE "SkillLesson" ADD CONSTRAINT "SkillLesson_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
];

async function main() {
  await client.connect();
  console.log("== ADDITIVE-ONLY sync v2 — Neon production ==");

  console.log("[1/6] JobType enum values (no transaction):");
  await addEnumValue("JobType", "REACTIVATION");
  await addEnumValue("JobType", "SOURCE_EVALUATION");
  await addEnumValue("JobType", "GIT_SKILLS_HARVEST");

  console.log("[2/6] Missing Lead columns (phone columns NOT touched):");
  await q(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "intentSignal" TEXT`);
  await q(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "sourcePlatform" TEXT`);
  console.log("  + Lead.intentSignal, Lead.sourcePlatform ensured");

  console.log("[3/6] Conversation extra columns:");
  await q(`ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "mode" TEXT`);
  await q(`ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "progress" TEXT`);
  await q(`ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "strategy" TEXT`);
  console.log("  + mode, progress, strategy ensured");

  console.log("[4/6] Missing tables (9):");
  for (const [name, ddl] of Object.entries(TABLES)) {
    await q(ddl);
    console.log(`  + ${name} ensured`);
  }

  console.log("[5/6] Indexes:");
  for (const sql of INDEXES) { await q(sql); }
  console.log(`  + ${INDEXES.length} indexes ensured`);

  console.log("[6/6] Foreign keys:");
  for (const [name, ddl] of FKS) { await fk(name, ddl); }

  // Post-verify: phone data must still be intact
  const phone = await client.query(`SELECT COUNT(*)::int AS c FROM "Lead" WHERE "phone" IS NOT NULL AND "phone" <> ''`);
  console.log(`\nPOST-CHECK: Lead rows with phone data = ${phone.rows[0].c} (expected >= 9)`);
  if (Number(phone.rows[0].c) < 9) {
    console.error("!! PHONE DATA REGRESSION — investigate immediately");
    process.exit(2);
  }
  const t = await client.query(`SELECT COUNT(*)::int AS c FROM information_schema.tables WHERE table_schema='public'`);
  console.log(`POST-CHECK: total tables now = ${t.rows[0].c}`);

  await client.end();
  console.log("DONE — additive sync complete, nothing dropped.");
}

main().catch(async (e) => {
  console.error("FATAL:", e.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
