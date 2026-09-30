#!/usr/bin/env node
/* Read-only schema diff: what the code expects vs what Neon actually has. */
const fs = require("fs");
let url = "";
for (const line of fs.readFileSync("/home/z/my-project/.env.prod-runtime", "utf8").split("\n")) {
  const m = line.match(/^DATABASE_URL=(.*)$/);
  if (m) { url = m[1].trim().replace(/^"|"$/g, ""); break; }
}
if (!url.startsWith("postgres")) { console.error("no DATABASE_URL"); process.exit(1); }

const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const tables = await c.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1`);
  console.log("== TABLES IN NEON ==");
  console.log(tables.rows.map(r => r.table_name).join(", "));

  const cols = await c.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='Lead' ORDER BY ordinal_position`);
  console.log("\n== Lead COLUMNS ==");
  console.log(cols.rows.map(r => r.column_name).join(", "));

  const enums = await c.query(
    `SELECT t.typname, string_agg(e.enumlabel, ',' ORDER BY enumsortorder) AS vals
     FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
     GROUP BY t.typname ORDER BY t.typname`);
  console.log("\n== ENUMS ==");
  for (const r of enums.rows) console.log(`${r.typname}: ${r.vals}`);

  await c.end();
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
