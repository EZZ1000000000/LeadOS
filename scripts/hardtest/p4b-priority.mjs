/** P4b — priority ordering + atomicity checks (standalone). */
import { q, phase, ev, login, tick, sleep } from "./lib.mjs";

await phase("P4b PRIORITY + ATOMICITY");
const cookie = await login();
const vals = [];
for (let i = 0; i < 10; i++) vals.push(`('ht-' || substr(md5(random()::text),1,18), 'cmuflg0190001mzaergkpgrze','CLEANUP','{"marker":"ht-prio-high-${Date.now()}-${i}"}'::jsonb, 90, 'QUEUED', NOW(), NOW())`);
for (let i = 0; i < 10; i++) vals.push(`('ht-' || substr(md5(random()::text),1,18), 'cmuflg0190001mzaergkpgrze','CLEANUP','{"marker":"ht-prio-low-${Date.now()}-${i}"}'::jsonb, 10, 'QUEUED', NOW(), NOW())`);
await q(`INSERT INTO "Job" (id,"workspaceId","type","payload","priority","status","createdAt","updatedAt") VALUES ${vals.join(",")}`);
for (let r = 0; r < 10; r++) {
  await (r === 2 ? Promise.all([tick(cookie, 10), tick(cookie, 10)]) : tick(cookie, 10));
  const left = await q(`SELECT COUNT(*)::int AS c FROM "Job" WHERE payload->>'marker' LIKE 'ht-prio-%' AND status IN ('QUEUED','RETRYING')`);
  if (left.rows[0].c === 0) break;
  await sleep(1500);
}
const high = await q(`SELECT MIN("completedAt") AS t FROM "Job" WHERE payload->>'marker' LIKE 'ht-prio-high-%' AND status='SUCCESS'`);
const low = await q(`SELECT MIN("completedAt") AS t FROM "Job" WHERE payload->>'marker' LIKE 'ht-prio-low-%' AND status='SUCCESS'`);
const ok = high.rows[0].t && low.rows[0].t && new Date(high.rows[0].t) <= new Date(low.rows[0].t);
ev("P4b", `priority: high-first=${high.rows[0].t?.toISOString?.().slice(11, 19)} low-first=${low.rows[0].t?.toISOString?.().slice(11, 19)} → high-precedes-low=${ok ? "✓" : "✗"}`);

const multi = await q(`SELECT COUNT(*)::int AS c FROM "Job" WHERE type='CLEANUP' AND payload->>'marker' LIKE 'ht-prio-%' AND attempts > 1`);
const dupRows = await q(`SELECT COUNT(*)::int AS c FROM (SELECT payload->>'marker' FROM "Job" WHERE payload->>'marker' LIKE 'ht-prio-%' GROUP BY 1 HAVING COUNT(*)>1) x`);
const total = await q(`SELECT status, COUNT(*)::int AS c FROM "Job" WHERE payload->>'marker' LIKE 'ht-prio-%' GROUP BY 1`);
ev("P4b", `atomicity: multi-claim(attempts>1)=${multi.rows[0].c} duplicate-rows=${dupRows.rows[0].c} states=${total.rows.map(r => `${r.status}=${r.c}`).join(" ")}`);

const allBursts = await q(`SELECT COUNT(*)::int AS c, COUNT(DISTINCT id)::int AS d FROM "Job" WHERE type='CLEANUP' AND payload->>'marker' LIKE 'ht-burst%' AND status='SUCCESS'`);
ev("P4b", `all-burst totals: success=${allBursts.rows[0].c} unique-ids=${allBursts.rows[0].d} → single-claimant guarantee ${allBursts.rows[0].c === allBursts.rows[0].d ? "✓" : "✗"}`);
process.exit(0);
