/**
 * P9 — STOP/START: chain-level stop (radar group paused → skipped → resume), heartbeat stop/start, global-stop reality check.
 */
import { q, phase, ev, login, api, sleep } from "./lib.mjs";
import { execSync } from "node:child_process";
import { envUrl } from "./lib.mjs";

await phase("P9 STOP/START");
const cookie = await login();

// --- chain stop: radar scans only ACTIVE/NEEDS_SESSION groups
const g = await q(`SELECT id, name FROM "MonitoredGroup" WHERE status='ACTIVE' ORDER BY "activityScore" DESC LIMIT 1`);
const G = g.rows[0];
await q(`UPDATE "MonitoredGroup" SET status='PAUSED' WHERE id=$1`, [G.id]);
ev("P9", `STOP radar-target: group ${(G.name ?? "").slice(0, 40)} → PAUSED`);
try {
  const out = execSync(`cd /home/z/my-project && DATABASE_URL="$HT_DB" && npx --yes tsx scripts/hardtest/radar-run.ts 2>&1 | tail -4`, { encoding: "utf8", timeout: 240_000, env: { ...process.env, HT_DB: envUrl() } });
  const scannedPaused = out.includes(`scanned=`) ? out.match(/scanned=(\d+)/)?.[1] : "?";
  const containsPaused = out.includes((G.name ?? "").slice(0, 20));
  ev("P9", `radar while paused: ${out.replace(/\n/g, " | ").slice(0, 220)} contains-paused-group=${containsPaused}`);
} catch (e) {
  ev("P9", `radar run error: ${String(e.message ?? e).slice(0, 160)}`);
}
await q(`UPDATE "MonitoredGroup" SET status='ACTIVE' WHERE id=$1`, [G.id]);
ev("P9", `RESUME radar-target: group back to ACTIVE`);
try {
  const out2 = execSync(`cd /home/z/my-project && DATABASE_URL="$HT_DB" && npx --yes tsx scripts/hardtest/radar-run.ts 2>&1 | tail -3`, { encoding: "utf8", timeout: 240_000, env: { ...process.env, HT_DB: envUrl() } });
  ev("P9", `radar after resume: ${out2.replace(/\n/g, " | ").slice(0, 220)}`);
} catch (e) {
  ev("P9", `radar resume error: ${String(e.message ?? e).slice(0, 160)}`);
}

// --- orchestrator feed stop/start (heartbeat loop = the real generation cadence)
const stopped = execSync("pkill -f tick-prod-loop.sh; echo killed", { encoding: "utf8" }).trim();
ev("P9", `GLOBAL- feed: heartbeat loop ${stopped}`);
const jobsAtStop = (await q(`SELECT COUNT(*)::int AS c FROM "Job" WHERE "createdAt" > NOW() - INTERVAL '1 minute'`)).rows[0].c;
await sleep(65_000);
const jobsDuringStop = (await q(`SELECT COUNT(*)::int AS c FROM "Job" WHERE "createdAt" > NOW() - INTERVAL '60 seconds'`)).rows[0].c;
ev("P9", `jobs created: last-min-before=${jobsAtStop} during-stop-window=${jobsDuringStop} (no ticks → no new scheduled jobs unless external traffic)`);

execSync("cd /home/z/my-project && setsid nohup bash scripts/tick-prod-loop.sh > /dev/null 2>&1 < /dev/null & disown; echo restarted", { encoding: "utf8" });
ev("P9", `START: heartbeat loop restarted (setsid)`);
await sleep(70_000);
const jobsAfterStart = (await q(`SELECT COUNT(*)::int AS c FROM "Job" WHERE "createdAt" > NOW() - INTERVAL '75 seconds'`)).rows[0].c;
const loopAlive = execSync("pgrep -fc tick-prod-loop.sh || true", { encoding: "utf8" }).trim();
ev("P9", `after START: jobs created=${jobsAfterStart} loop-processes=${loopAlive} → cadence restored ${Number(loopAlive) >= 1 ? "✓" : "✗"}`);

// --- global STOP reality check (honest)
const sysState = await q(`SELECT key, LEFT(value::text, 120) AS v FROM "SystemState" LIMIT 5`).catch(() => null);
ev("P9", `global-STOP mechanism in code: NO dedicated kill-switch found (SystemState keys: ${sysState ? sysState.rows.map(r => r.key).join(",") || "empty" : "n/a"}) — nearest equivalents tested above (chain pause + feed stop/start)`);
process.exit(0);
