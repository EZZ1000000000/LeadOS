/**
 * P11 — QUEUE RATES + DASHBOARD STRESS + Dashboard-vs-DB consistency.
 */
import { q, snapshot, printSnap, phase, ev, login, api } from "./lib.mjs";

await phase("P11 RATES + DASHBOARD");
const s0 = await snapshot();
printSnap(s0, "rates-window-start");
await new Promise(r => setTimeout(r, 60_000));
const s1 = await snapshot();
const mins = 1;
ev("P11", `created/min=${(s1.jobs_total - s0.jobs_total) / mins} completed/min=${(s1.jobs_success - s0.jobs_success) / mins} queue-depth=${s1.jobs_queued + s1.jobs_retrying} (peak this window: ${Math.max(s0.jobs_queued, s1.jobs_queued)})`);
const deep = await q(`SELECT
  COUNT(*) FILTER (WHERE "createdAt" > NOW() - INTERVAL '60 minutes')::int AS created60,
  COUNT(*) FILTER (WHERE "completedAt" > NOW() - INTERVAL '60 minutes' AND status='SUCCESS')::int AS done60
  FROM "Job"`);
ev("P11", `last-60min: created=${deep.rows[0].created60} completed=${deep.rows[0].done60} → throughput ratio=${(deep.rows[0].done60 / Math.max(1, deep.rows[0].created60)).toFixed(2)}`);

const cookie = await login();
// dashboard stress: 10 parallel dashboard hits during live ops
const paths = ["/api/overview", "/api/analytics", "/api/platforms", "/api/feed", "/api/leads"];
const t0 = Date.now();
const hits = [];
for (let i = 0; i < 10; i++) hits.push(api(cookie, paths[i % paths.length]));
const results = await Promise.all(hits);
const msAll = results.map(r => r.ms);
ev("P11", `dashboard stress (10 parallel): min=${Math.min(...msAll)}ms max=${Math.max(...msAll)}ms avg=${Math.round(msAll.reduce((a, b) => a + b, 0) / msAll)}ms statuses=${results.map(r => r.status).join(",")}`);

// dashboard vs DB — no silent divergence
const an = results.find(r => r.body?.funnel);
const dbLeads = (await q(`SELECT COUNT(*)::int AS c FROM "Lead"`)).rows[0].c;
ev("P11", `dashboard-vs-DB: analytics.funnel.totalLeads=${an?.body?.funnel?.totalLeads ?? "?"} DB=${dbLeads} match=${an?.body?.funnel?.totalLeads === dbLeads ? "✓" : "✗"}`);

const ov = results.find(r => r.body?.kpis);
if (ov?.body?.kpis) {
  const hot = (await q(`SELECT COUNT(*)::int AS c FROM "Lead" WHERE temperature='HOT'`)).rows[0].c;
  const tasks = (await q(`SELECT COUNT(*)::int AS c FROM "Task" WHERE status='TODO'`)).rows[0].c;
  const alerts = (await q(`SELECT COUNT(*)::int AS c FROM "Alert" WHERE "isRead"=false`)).rows[0].c;
  ev("P11", `dashboard-vs-DB: overview.hotLeads=${ov.body.kpis.hotLeads} DB=${hot} | dueTasks=${ov.body.kpis.dueTasks} DB=${tasks} | unreadAlerts=${ov.body.kpis.unreadAlerts} DB=${alerts}`);
}
const pf = results.find(r => Array.isArray(r.body?.rows));
ev("P11", `dashboard-vs-DB: platforms rows=${pf?.body?.rows?.length ?? "?"} mode=${pf?.body?.mode ?? "?"} (capability matrix=20)`);
process.exit(0);
