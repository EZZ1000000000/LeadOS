/** P9b — heartbeat (feed) stop/start + global-stop reality check. */
import { q, ev, phase, sleep } from "./lib.mjs";
import { execSync } from "node:child_process";

await phase("P9b FEED STOP/START");
execSync('pkill -f "[t]ick-prod-loop" || true', { encoding: "utf8" });
ev("P9b", "feed stopped (heartbeat loop killed)");
const before = (await q(`SELECT COUNT(*)::int AS c FROM "Job" WHERE "createdAt" > NOW() - INTERVAL '1 minute'`)).rows[0].c;
await sleep(70_000);
const during = (await q(`SELECT COUNT(*)::int AS c FROM "Job" WHERE "createdAt" > NOW() - INTERVAL '70 seconds'`)).rows[0].c;
ev("P9b", `jobs created: last-min-before-stop=${before} during-stop-window=${during}`);
execSync('cd /home/z/my-project && setsid nohup bash scripts/tick-prod-loop.sh > /dev/null 2>&1 < /dev/null & echo x', { encoding: "utf8" });
ev("P9b", "feed restarted");
await sleep(80_000);
const after = (await q(`SELECT COUNT(*)::int AS c FROM "Job" WHERE "createdAt" > NOW() - INTERVAL '85 seconds'`)).rows[0].c;
const alive = execSync('pgrep -fc "[t]ick-prod-loop" || true', { encoding: "utf8" }).trim();
const lastTickLog = execSync("tail -1 /home/z/my-project/db/backups/tick-prod.log", { encoding: "utf8" }).trim();
ev("P9b", `after restart: new-jobs=${after} loop-alive=${alive} lastTick="${lastTickLog.slice(0, 90)}"`);
ev("P9b", `global-STOP mechanism: no dedicated kill-switch in code — nearest equivalents tested: chain pause (P9) + feed stop/start (here)`);
process.exit(0);
