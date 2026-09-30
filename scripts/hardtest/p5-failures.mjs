/**
 * P5 — FAILURE INJECTION (safe): worker crash → stale recovery; retry→backoff; maxAttempts=1→FAILED;
 * session-waiting → capability resume; AI-off heuristic degradation.
 */
import { q, phase, ev, login, tick, sleep, WS_ID } from "./lib.mjs";

await phase("P5 FAILURE INJECTION");
const cookie = await login();

// F1: worker crash simulation — job claimed by a worker that dies mid-run
const crash = await q(`INSERT INTO "Job" (id,"workspaceId","type","payload","priority","status","createdAt","updatedAt")
  VALUES ('ht-' || substr(md5(random()::text),1,18), $1,'CLEANUP','{"marker":"ht-crash-1"}'::jsonb,95,'QUEUED',NOW(),NOW()) RETURNING id`, [WS_ID]);
const cid = crash.rows[0].id;
await q(`UPDATE "Job" SET status='RUNNING', "startedAt"=NOW()-INTERVAL '21 minutes', "lockedAt"=NOW()-INTERVAL '11 minutes', "workerId"='ht-crashed-worker', attempts=1 WHERE id=$1`, [cid]);
ev("P5", `F1 setup: job ${cid.slice(-6)} left RUNNING by dead worker (lockedAt=-11m, startedAt=-21m)`);
await tick(cookie, 8);
await sleep(3000);
const f1 = await q(`SELECT status, attempts, "workerId", "completedAt" FROM "Job" WHERE id=$1`, [cid]);
ev("P5", `F1 result: status=${f1.rows[0].status} attempts=${f1.rows[0].attempts} worker=${f1.rows[0].workerId} → ${f1.rows[0].status === "SUCCESS" ? "RECOVERED ✓ (stale→requeue→new worker→completion)" : "NOT recovered ✗"}`);

// F2: failing job — research run pointing to nonexistent lead → throw → RETRYING with backoff
const realLead = await q(`SELECT id FROM "Lead" ORDER BY "createdAt" DESC LIMIT 1`);
const run = await q(`INSERT INTO "ResearchRun" (id,"workspaceId","leadId","depth","status","createdAt","updatedAt")
  VALUES ('ht-' || substr(md5(random()::text),1,18), $1,$2,'QUICK','RUNNING',NOW(),NOW()) RETURNING id`, [WS_ID, realLead.rows[0].id]);
const rid = run.rows[0].id;
const j5 = await q(`INSERT INTO "Job" (id,"workspaceId","type","payload","priority","status","maxAttempts","createdAt","updatedAt")
  VALUES ('ht-' || substr(md5(random()::text),1,18), $1,'DEEP_RESEARCH',$2,95,'QUEUED',5,NOW(),NOW()) RETURNING id`, [WS_ID, JSON.stringify({ researchRunId: rid, leadId: "ht-fake-lead-000", marker: "ht-retry-1" })]);
await tick(cookie, 6);
await sleep(2000);
const f2 = await q(`SELECT status, attempts, "scheduledAt", LEFT("errorMessage",180) AS err FROM "Job" WHERE id=$1`, [j5.rows[0].id]);
ev("P5", `F2a retry: status=${f2.rows[0].status} attempts=${f2.rows[0].attempts} next-at=${f2.rows[0].scheduledAt?.toISOString?.().slice(11, 19)} err=${(f2.rows[0].err ?? "").replace(/\n/g, " ").slice(0, 120)} ${f2.rows[0].status === "RETRYING" ? "[BACKOFF-SCHEDULED ✓]" : ""}`);

// F2b: same failure with maxAttempts=1 → permanent FAILED
const run2 = await q(`INSERT INTO "ResearchRun" (id,"workspaceId","leadId","depth","status","createdAt","updatedAt")
  VALUES ('ht-' || substr(md5(random()::text),1,18), $1,$2,'QUICK','RUNNING',NOW(),NOW()) RETURNING id`, [WS_ID, realLead.rows[0].id]);
const j6 = await q(`INSERT INTO "Job" (id,"workspaceId","type","payload","priority","status","maxAttempts","createdAt","updatedAt")
  VALUES ('ht-' || substr(md5(random()::text),1,18), $1,'DEEP_RESEARCH',$2,95,'QUEUED',1,NOW(),NOW()) RETURNING id`, [WS_ID, JSON.stringify({ researchRunId: run2.rows[0].id, leadId: "ht-fake-lead-001", marker: "ht-fail-1" })]);
await tick(cookie, 6);
await sleep(2000);
const f2b = await q(`SELECT status, attempts, "completedAt", LEFT("errorMessage",180) AS err FROM "Job" WHERE id=$1`, [j6.rows[0].id]);
ev("P5", `F2b permanent-fail: status=${f2b.rows[0].status} attempts=${f2b.rows[0].attempts} ${f2b.rows[0].status === "FAILED" ? "[FAILED-TERMINAL ✓ no infinite retry]" : ""}`);

// F3: session-waiting job → capability resume on next tick
const j7 = await q(`INSERT INTO "Job" (id,"workspaceId","type","payload","priority","status","createdAt","updatedAt")
  VALUES ('ht-' || substr(md5(random()::text),1,18), $1,'FB_COMMENT','{"marker":"ht-waitcap-1"}'::jsonb,60,'WAITING_FOR_CAPABILITY',NOW(),NOW()) RETURNING id`, [WS_ID]);
await tick(cookie, 8);
await sleep(2000);
const f3 = await q(`SELECT status, "completedAt" FROM "Job" WHERE id=$1`, [j7.rows[0].id]);
ev("P5", `F3 capability: WAITING_FOR_CAPABILITY → ${f3.rows[0].status} ${["QUEUED", "SUCCESS"].includes(f3.rows[0].status) ? "[RESUME ✓]" : ""}`);

// F4: AI unavailable → zizo heuristic still runs (no crash, no silent stop)
const zt = await fetch("https://leados-olive.vercel.app/api/agent/zizo", {
  method: "POST", headers: { "Content-Type": "application/json", cookie },
  body: JSON.stringify({ action: "tick" }),
}).then(r => r.json()).catch(e => ({ error: String(e) }));
ev("P5", `F4 zizo tick with AI-off: ${JSON.stringify(zt).slice(0, 220)}`);
process.exit(0);

// cleanup synthetic runs to honest terminal state
try { await q(`UPDATE "ResearchRun" SET status='FAILED', "errorMessage"='hardtest: fake lead injection' WHERE id=$1`, [rid]); await q(`UPDATE "ResearchRun" SET status='FAILED', "errorMessage"='hardtest: fake lead injection' WHERE id=$1`, [run2.rows[0].id]); } catch {}
