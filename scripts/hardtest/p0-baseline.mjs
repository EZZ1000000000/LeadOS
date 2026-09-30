/**
 * P0 — Baseline snapshot (source of truth: production Neon).
 */
import { q, snapshot, printSnap, phase, ev } from "./lib.mjs";

await phase("P0 BASELINE");
const s = await snapshot();
printSnap(s, "BASELINE t0");
const lastJobs = await q(`SELECT type, status, COUNT(*)::int AS c FROM "Job" GROUP BY 1,2 ORDER BY 3 DESC LIMIT 12`);
for (const r of lastJobs.rows) ev("P0", `jobs by type/status: ${r.type}/${r.status}=${r.c}`);
const lastLead = await q(`SELECT l.id, l."createdAt", b.name, l.score FROM "Lead" l LEFT JOIN "Business" b ON b.id=l."businessId" ORDER BY l."createdAt" DESC LIMIT 3`);
for (const r of lastLead.rows) ev("P0", `recent lead: ${r.id} score=${r.score} biz=${(r.name ?? "").slice(0, 40)} at=${r.createdAt?.toISOString?.() ?? r.createdAt}`);
process.exit(0);
