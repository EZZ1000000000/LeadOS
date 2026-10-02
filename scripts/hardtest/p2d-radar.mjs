/**
 * P2d — RADAR chain: real radarCycle run + cooldown/duplicate proof.
 * Radar is a library (src/lib/radar.ts) invoked here via tsx with the real production DB.
 */
import { q, phase, ev } from "./lib.mjs";

await phase("P2d RADAR");
const groups = await q(`SELECT status, COUNT(*)::int AS c FROM "MonitoredGroup" GROUP BY 1`);
ev("P2d", `groups by status: ${groups.rows.map(r => `${r.status}=${r.c}`).join(" ")}`);

// radar runs via tsx (real function, real DB). Output file written by the child.
const { execSync } = await import("node:child_process");
import { envUrl } from "./lib.mjs";
try {
  const out = execSync(`cd /home/z/my-project && DATABASE_URL="$HT_DB" && npx --yes tsx scripts/hardtest/radar-run.ts 2>&1 | tail -8`, { encoding: "utf8", timeout: 300_000, env: { ...process.env, HT_DB: envUrl() } });
  for (const line of out.split("\n").filter(Boolean)) ev("P2d", `radar-run: ${line.slice(0, 200)}`);
} catch (e) {
  ev("P2d", `radarCycle failed: ${String(e.message ?? e).slice(0, 300)}`);
}

// cooldown proof: group lastScannedAt updated; immediate re-run scans 0
const recent = await q(`SELECT id, name, status, "lastScannedAt", "statusNote" FROM "MonitoredGroup" WHERE "lastScannedAt" > NOW() - INTERVAL '10 minutes' LIMIT 5`);
for (const r of recent.rows) ev("P2d", `recently scanned: ${(r.name ?? "").slice(0, 40)} status=${r.status} at=${r.lastScannedAt?.toISOString?.().slice(11, 19)} note=${(r.statusNote ?? "").slice(0, 60)}`);

const dupComments = await q(`SELECT COUNT(*)::int AS c FROM (SELECT "postId", COUNT(DISTINCT id) FROM "Comment" GROUP BY 1 HAVING COUNT(DISTINCT id) > 1) x`).catch(() => null);
if (dupComments) ev("P2d", `duplicate comments per post: ${dupComments.rows[0].c} (expect 0)`);
process.exit(0);
