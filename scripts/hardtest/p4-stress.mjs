/**
 * P4 — QUEUE STRESS: bursts 10/25/50/100 + atomicity (single claimant) + priority + concurrent ticks.
 * Uses CLEANUP type (no external handler → pure queue mechanics, completes with note).
 */
import { q, phase, ev, login, tick, sleep } from "./lib.mjs";

await phase("P4 QUEUE STRESS");
const cookie = await login();
const MARK = "ht-burst" + Math.floor(Date.now()/1000);

async function burst(n, prio) {
  const vals = [];
  for (let i = 0; i < n; i++) {
    vals.push(`('ht-' || substr(md5(random()::text),1,18), 'cmuflg0190001mzaergkpgrze','CLEANUP', '{"marker":"${MARK}-${n}-${i}"}'::jsonb, ${prio}, 'QUEUED', NOW(), NOW())`);
  }
  await q(`INSERT INTO "Job" (id,"workspaceId","type","payload","priority","status","createdAt","updatedAt") VALUES ${vals.join(",")}`);
}

async function drain(n, rounds = 16, concurrentAt = 3) {
  for (let r = 0; r < rounds; r++) {
    if (r === concurrentAt) {
      // two ticks fired simultaneously — worker race test
      await Promise.all([tick(cookie, 10), tick(cookie, 10)]);
    } else {
      await tick(cookie, 10);
    }
    const left = await q(`SELECT COUNT(*)::int AS c FROM "Job" WHERE type='CLEANUP' AND payload->>'marker' LIKE $1 AND status IN ('QUEUED','RETRYING')`, [`${MARK}-${n}%`]);
    if (left.rows[0].c === 0) break;
    await sleep(1200);
  }
}

for (const n of [10, 25, 50, 100]) {
  await burst(n, 50);
  const t0 = Date.now();
  await drain(n);
  const res = await q(`SELECT status, COUNT(*)::int AS c, COUNT(DISTINCT id)::int AS d FROM "Job" WHERE payload->>'marker' LIKE $1 GROUP BY 1`, [`${MARK}-${n}%`]);
  ev("P4", `burst ${n}: ${res.rows.map(r => `${r.status}=${r.c}(uniq${r.d})`).join(" ")} drained in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// priority: 20 jobs, half prio 90, half prio 10 — high must start completing first
await burst(0, 0);
const vals = [];
for (let i = 0; i < 10; i++) vals.push(`('ht-' || substr(md5(random()::text),1,18), 'cmuflg0190001mzaergkpgrze','CLEANUP','{"marker":"ht-prio-high-${i}"}'::jsonb, 90, 'QUEUED', NOW(), NOW())`);
for (let i = 0; i < 10; i++) vals.push(`('ht-' || substr(md5(random()::text),1,18), 'cmuflg0190001mzaergkpgrze','CLEANUP','{"marker":"ht-prio-low-${i}"}'::jsonb, 10, 'QUEUED', NOW(), NOW())`);
await q(`INSERT INTO "Job" (id,"workspaceId","type","payload","priority","status","createdAt","updatedAt") VALUES ${vals.join(",")}`);
for (let r = 0; r < 10; r++) {
  await (r === 3 ? Promise.all([tick(cookie, 10), tick(cookie, 10)]) : tick(cookie, 10));
  const left = await q(`SELECT COUNT(*)::int AS c FROM "Job" WHERE payload->>'marker' LIKE 'ht-prio-%' AND status IN ('QUEUED','RETRYING')`);
  if (left.rows[0].c === 0) break;
  await sleep(1200);
}
const high = await q(`SELECT MIN("completedAt") AS t FROM "Job" WHERE payload->>'marker' LIKE 'ht-prio-high-%' AND status='SUCCESS'`);
const low = await q(`SELECT MIN("completedAt") AS t FROM "Job" WHERE payload->>'marker' LIKE 'ht-prio-low-%' AND status='SUCCESS'`);
ev("P4", `priority: high-first-completed=${high.rows[0].t?.toISOString?.() ?? high.rows[0].t} low-first=${low.rows[0].t?.toISOString?.() ?? low.rows[0].t} → high≤low = ${new Date(high.rows[0].t) <= new Date(low.rows[0].t)}`);

// atomicity: no job claimed twice, no duplicates
const dup = await q(`SELECT COUNT(*)::int AS c FROM (SELECT payload->>'marker' AS m FROM "Job" WHERE payload->>'marker' LIKE 'ht-burst%' GROUP BY 1 HAVING COUNT(*) > 1) x`);
const races = await q(`SELECT COUNT(*)::int AS c FROM "Job" WHERE type='CLEANUP' AND payload->>'marker' LIKE 'ht-burst%' AND attempts > 1`);
ev("P4", `atomicity: duplicate-markers=${dup.rows[0].c} (expect 0) multi-claim(attempts>1)=${races.rows[0].c} (expect 0)`);
process.exit(0);
