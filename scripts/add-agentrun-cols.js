/**
 * ADDITIVE-ONLY: add AgentRun.mode/progress/strategy to Neon (mirrors schema.production.prisma fix).
 * No DROP. Idempotent. Phone columns untouched.
 */
const fs = require("fs");
let url = "";
for (const line of fs.readFileSync("/home/z/my-project/.env.prod-runtime", "utf8").split("\n")) {
  const m = line.match(/^DATABASE_URL=(.*)$/);
  if (m) { url = m[1].trim().replace(/^"|"$/g, ""); break; }
}
const { Client } = require("pg");
const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

(async () => {
  await c.connect();
  await c.query(`ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'SCRIPTED'`);
  await c.query(`ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "progress" INTEGER NOT NULL DEFAULT 0`);
  await c.query(`ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "strategy" JSONB`);
  const r = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='AgentRun' ORDER BY ordinal_position`);
  console.log("AgentRun columns now:", r.rows.map(x => x.column_name).join(", "));
  // safety: phone data still intact
  const p = await c.query(`SELECT COUNT(*)::int AS c FROM "Lead" WHERE "phone" IS NOT NULL AND "phone" <> ''`);
  console.log("Lead rows with phone data:", p.rows[0].c, "(expected >= 9)");
  await c.end();
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
