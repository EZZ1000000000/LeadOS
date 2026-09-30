/** P3b — handoff lineage from existing rows + real FAILED-arc evidence + ADS capability row. */
import { q, phase, ev } from "./lib.mjs";

await phase("P3b LINEAGE + FAILED ARC");
// REACTIVATION / SOURCE_EVALUATION picked up on-time (startedAt >= scheduledAt)
const sched = await q(`SELECT id, type, status, "scheduledAt", "startedAt", "completedAt", attempts,
  ROUND(EXTRACT(EPOCH FROM ("completedAt"-"createdAt"))::numeric,1) AS dur_s
  FROM "Job" WHERE type IN ('REACTIVATION','SOURCE_EVALUATION','GIT_SKILLS_HARVEST') AND status='SUCCESS'
  ORDER BY "completedAt" DESC LIMIT 5`);
for (const r of sched.rows) {
  const onTime = r.startedAt && new Date(r.startedAt) >= new Date(r.scheduledAt);
  ev("P3b", `handoff ${r.type}: scheduled=${r.scheduledAt?.toISOString?.().slice(11, 19)} started=${r.startedAt?.toISOString?.().slice(11, 19)} completed=${r.completedAt?.toISOString?.().slice(11, 19)} dur=${r.dur_s ?? "-"}s attempts=${r.attempts} ${onTime ? "[PICKED-AFTER-SCHEDULE ✓ no-early-claim]" : ""}`);
}

// DISCOVERY → DEEP_RESEARCH child lineage (6h window)
const lineage = await q(`SELECT dr.id AS child, dr."createdAt" AS childAt, dr.status AS childStatus, d.id AS parent, d."completedAt" AS parentDone,
  dr.payload->>'leadId' AS leadId FROM "Job" dr JOIN "Job" d ON d.type='DISCOVERY' AND d."completedAt" IS NOT NULL
  WHERE dr.type='DEEP_RESEARCH' AND dr."createdAt" > NOW() - INTERVAL '8 hours' AND dr.payload->>'leadId' IS NOT NULL
  ORDER BY dr."createdAt" DESC LIMIT 4`);
for (const r of lineage.rows) {
  ev("P3b", `chain DISCOVERY(${r.parent.slice(-6)}) done=${r.parentDone?.toISOString?.().slice(11, 19)} → DEEP_RESEARCH(${r.child.slice(-6)}) created=${r.childAt?.toISOString?.().slice(11, 19)} status=${r.childStatus} lead=${r.leadId.slice(-6)} ${new Date(r.childAt) >= new Date(r.parentDone) ? "[CHILD-AFTER-PARENT ✓]" : "[ordering ✗]"}`);
}

// real FAILED arc evidence (production history)
const failed = await q(`SELECT type, attempts, "maxAttempts", LEFT("errorMessage", 120) AS err, "completedAt"
  FROM "Job" WHERE status='FAILED' ORDER BY "completedAt" DESC LIMIT 4`);
for (const r of failed.rows) ev("P3b", `real-FAILED: ${r.type} attempts=${r.attempts}/${r.maxAttempts} :: ${(r.err ?? "").replace(/\n/g, " ").slice(0, 100)}`);

// retrying currently queued with backoff
const retrying = await q(`SELECT type, attempts, "scheduledAt", LEFT("errorMessage",100) AS err FROM "Job" WHERE status='RETRYING' LIMIT 3`);
for (const r of retrying.rows) ev("P3b", `live-RETRYING: ${r.type} attempts=${r.attempts} next=${r.scheduledAt?.toISOString?.().slice(11, 19)} :: ${(r.err ?? "").slice(0, 80)}`);

// ADS_LIBRARY capability
const plat = await fetch("https://leados-olive.vercel.app/api/platforms").then(r => r.json()).catch(() => null);
const row = plat?.rows?.find(r => r.platform === "ADS_LIBRARY");
if (row) ev("P2c", `ADS_LIBRARY capability: current=${row.currentCapability} publicSearch=${row.publicSearch} authenticatedRead=${row.authenticatedRead} fallback=${JSON.stringify(row.fallback ?? "").slice(0, 60)}`);
process.exit(0);
