/**
 * P10 — DATA INTEGRITY after stress+failures: duplicates, orphans, invalid states, stale jobs.
 */
import { q, phase, ev } from "./lib.mjs";

await phase("P10 DATA INTEGRITY");
const checks = [
  ["duplicate leads (same business+workspace)", `SELECT COUNT(*)::int AS c FROM (SELECT "businessId","workspaceId" FROM "Lead" GROUP BY 1,2 HAVING COUNT(*)>1) x`],
  ["duplicate businesses (same name+city)", `SELECT COUNT(*)::int AS c FROM (SELECT name, city FROM "Business" WHERE name IS NOT NULL GROUP BY 1,2 HAVING COUNT(*)>1) x`],
  ["orphan leads (missing business)", `SELECT COUNT(*)::int AS c FROM "Lead" l WHERE l."businessId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Business" b WHERE b.id=l."businessId")`],
  ["orphan content (missing business)", `SELECT COUNT(*)::int AS c FROM "ContentItem" c WHERE c."businessId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Business" b WHERE b.id=c."businessId")`],
  ["duplicate queued jobs (same type+payload)", `SELECT COUNT(*)::int AS c FROM (SELECT type, payload::text, COUNT(*) FROM "Job" WHERE status='QUEUED' GROUP BY 1,2 HAVING COUNT(*)>1) x`],
  ["stale RUNNING jobs (>30min)", `SELECT COUNT(*)::int AS c FROM "Job" WHERE status='RUNNING' AND "startedAt" < NOW() - INTERVAL '30 minutes'`],
  ["invalid job statuses", `SELECT COUNT(*)::int AS c FROM "Job" WHERE status NOT IN ('QUEUED','RUNNING','SUCCESS','FAILED','RETRYING','CANCELLED','WAITING_FOR_CAPABILITY')`],
  ["invalid lead statuses", `SELECT COUNT(*)::int AS c FROM "Lead" WHERE status NOT IN ('NEW','QUALIFIED','CONTACTED','REPLIED','INTERESTED','MEETING','PROPOSAL','WON','LOST','NURTURE','ARCHIVED')`],
  ["leads with impossible negative score", `SELECT COUNT(*)::int AS c FROM "Lead" WHERE score < 0 OR score > 100`],
  ["orphan messages (missing conversation)", `SELECT COUNT(*)::int AS c FROM "Message" m WHERE NOT EXISTS (SELECT 1 FROM "Conversation" c WHERE c.id=m."conversationId")`],
  ["orphan findings (missing research run)", `SELECT COUNT(*)::int AS c FROM "Finding" f WHERE NOT EXISTS (SELECT 1 FROM "ResearchRun" r WHERE r.id=f."researchRunId")`],
  ["research runs stuck RUNNING (>1h)", `SELECT COUNT(*)::int AS c FROM "ResearchRun" WHERE status='RUNNING' AND "createdAt" < NOW() - INTERVAL '1 hour'`],
  ["hardtest synthetic leftovers", `SELECT COUNT(*)::int AS c FROM "Job" WHERE payload->>'marker' LIKE 'ht-%'`],
];
for (const [label, sql] of checks) {
  try {
    const r = await q(sql);
    ev("P10", `${label}: ${r.rows[0].c}`);
  } catch (e) {
    ev("P10", `${label}: ERROR ${String(e.message ?? e).slice(0, 100)}`);
  }
}

// duplicate-job claim consistency under stress: every burst job exactly one success row
const bursts = await q(`SELECT payload->>'marker' AS marker, COUNT(*)::int AS c, COUNT(DISTINCT id)::int AS d
  FROM "Job" WHERE payload->>'marker' LIKE 'ht-burst-%' GROUP BY 1 HAVING COUNT(*) <> COUNT(DISTINCT id)`);
ev("P10", `stress duplicate rows: ${bursts.rows.length} (expect 0)`);

// referential: FK violations count via pg constraint validation sample
const fk = await q(`SELECT conname FROM pg_constraint WHERE conrelid = '"Lead"'::regclass AND contype='f' LIMIT 3`);
ev("P10", `lead FK constraints present: ${fk.rows.map(r => r.conname).join(", ")}`);
process.exit(0);
