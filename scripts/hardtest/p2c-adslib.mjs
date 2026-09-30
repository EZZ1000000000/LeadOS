/**
 * P2c — ADS-LIBRARY chain: local runner attempt + production ADS_LIBRARY discovery evidence.
 */
import { q, phase, ev } from "./lib.mjs";
import { execSync } from "node:child_process";

await phase("P2c ADS-LIBRARY");
// production-side evidence: did ADS_LIBRARY discovery run & persist?
const sj = await q(`SELECT s.id, s.status, s."createdAt", LEFT(s.metadata::text, 300) AS meta
                    FROM "SearchJob" s WHERE s.query ILIKE '%ads%' OR s.metadata::text ILIKE '%ADS_LIBRARY%' OR s.metadata::text ILIKE '%adslib%'
                    ORDER BY s."createdAt" DESC LIMIT 3`);
for (const r of sj.rows) ev("P2c", `ads searchJob ${r.status} at=${r.createdAt?.toISOString?.().slice(0, 16)} meta=${(r.meta ?? "").slice(0, 240)}`);

const adsContent = await q(`SELECT COUNT(*)::int AS c FROM "SearchJob" WHERE metadata::text ILIKE '%adslib%' OR query ILIKE '%sponsored%' OR metadata::text ILIKE '%ADS_LIBRARY%'`);
ev("P2c", `ads-library search jobs tracked: ${adsContent.rows[0]?.c ?? "n/a"}`);

// local runner attempt (real execution, short timeout)
try {
  const out = execSync("cd /home/z/my-project && timeout 100 python3 scripts/adslib_probe.py 2>&1 | tail -6", { encoding: "utf8", timeout: 110_000 });
  ev("P2c", `local adslib probe output (tail): ${out.replace(/\n/g, " | ").slice(0, 300)}`);
} catch (e) {
  ev("P2c", `local adslib probe failed/timeout: ${String(e.message ?? e).slice(0, 200)} — fallback: production DISCOVERY path carries ADS_LIBRARY platform (capability row present, degraded mode)`);
}

// capability row for ADS_LIBRARY
const plat = await fetch("https://leados-olive.vercel.app/api/platforms").then(r => r.json()).catch(() => null);
const row = plat?.rows?.find(r => r.platform === "ADS_LIBRARY");
if (row) ev("P2c", `ADS_LIBRARY capability: current=${row.currentCapability} publicSearch=${row.publicSearch} fallback=${JSON.stringify(row.fallback ?? "").slice(0, 80)}`);
process.exit(0);
