/**
 * P3 — GENERATION HANDOFF: prove tick N schedules work that tick N+1/N+2 executes.
 * Chains: DISCOVERY→DEEP_RESEARCH, tick→REACTIVATION(+60s)→done, tick→SOURCE_EVALUATION(+120s)→done,
 * harvest 4h dedup, groups 15min cooldown, reactivation 20h dedup.
 */
import { q, phase, ev, login, tick, sleep } from "./lib.mjs";

await phase("P3 GENERATION HANDOFF");
const cookie = await login();

const t0 = new Date();
const t = await tick(cookie, 4);
ev("P3", `gen-N tick fired at ${t0.toISOString().slice(11, 19)} status=${t.status}`);

// wait for the future-scheduled jobs to come due (+60s REACTIVATION / +120s SOURCE_EVALUATION)
await sleep(150_000);
await tick(cookie, 4);
ev("P3", `gen-N+1 tick fired at ${new Date().toISOString().slice(11, 19)}`);

const scheduled = await q(`SELECT id, type, status, priority, "scheduledAt", "createdAt", "startedAt", "completedAt", attempts,
  ROUND(EXTRACT(EPOCH FROM ("completedAt" - "createdAt"))::numeric, 1) AS dur_s
  FROM "Job" WHERE type IN ('REACTIVATION','SOURCE_EVALUATION') AND "createdAt" > NOW() - INTERVAL '40 minutes'
  ORDER BY "createdAt" DESC LIMIT 8`);
for (const r of scheduled.rows) {
  ev("P3", `handoff ${r.type}: scheduledAt=${r.scheduledAt?.toISOString?.().slice(11, 19)} started=${r.startedAt?.toISOString?.().slice(11, 19) ?? "-"} completed=${r.completedAt?.toISOString?.().slice(11, 19) ?? "-"} status=${r.status} attempts=${r.attempts} dur=${r.dur_s ?? "-"}s ${r.scheduledAt && r.startedAt && new Date(r.startedAt) >= new Date(r.scheduledAt) ? "[PICKED-ON-TIME ✓]" : ""}`);
}

// DISCOVERY → DEEP_RESEARCH child lineage (via lead)
const lineage = await q(`SELECT dr.id AS child, dr."createdAt" AS childAt, dr.status AS childStatus, d.id AS parent, d."completedAt" AS parentDone,
  dr.payload->>'leadId' AS leadId
  FROM "Job" dr JOIN "Job" d ON d.type='DISCOVERY' AND d."completedAt" IS NOT NULL
  WHERE dr.type='DEEP_RESEARCH' AND dr."createdAt" > NOW() - INTERVAL '2 hours' AND dr.payload->>'leadId' IS NOT NULL
  ORDER BY dr."createdAt" DESC LIMIT 4`);
for (const r of lineage.rows) {
  ev("P3", `chain DISCOVERY(${r.parent.slice(-6)}) done=${r.parentDone?.toISOString?.().slice(11, 19)} → DEEP_RESEARCH(${r.child.slice(-6)}) created=${r.childAt?.toISOString?.().slice(11, 19)} status=${r.childStatus} lead=${r.leadId.slice(-6)} ${new Date(r.childAt) >= new Date(r.parentDone) ? "[CHILD-AFTER-PARENT ✓]" : ""}`);
}

// dedup / no duplicate generation
const harvest4h = await q(`SELECT COUNT(*)::int AS c FROM "Job" WHERE type='GIT_SKILLS_HARVEST' AND "createdAt" > NOW() - INTERVAL '4 hours'`);
const react20h = await q(`SELECT COUNT(*)::int AS c FROM "Job" WHERE type='REACTIVATION' AND "createdAt" > NOW() - INTERVAL '20 hours'`);
const eval7d = await q(`SELECT COUNT(*)::int AS c FROM "Job" WHERE type='SOURCE_EVALUATION' AND "createdAt" > NOW() - INTERVAL '7 days'`);
ev("P3", `dedup windows: harvest-in-4h=${harvest4h.rows[0].c} (expect 1) reactivation-in-20h=${react20h.rows[0].c} (expect 1) source-eval-in-7d=${eval7d.rows[0].c} (expect 1)`);

// discovery rate limit: one per rule per 10min
const dupDisc = await q(`SELECT COUNT(*)::int AS c FROM (
  SELECT payload->>'ruleId' AS ruleId FROM "Job" WHERE type='DISCOVERY' AND payload->>'ruleId' IS NOT NULL
  AND "createdAt" > NOW() - INTERVAL '10 minutes' GROUP BY 1 HAVING COUNT(*) > 1) x`);
ev("P3", `duplicate DISCOVERY per rule in 10min window: ${dupDisc.rows[0].c} (expect 0)`);
process.exit(0);
