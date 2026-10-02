/**
 * P1 — FULL PRODUCTION RUN: real discovery waves on production (fullSweep + follow-up tick).
 */
import { snapshot, printSnap, delta, phase, ev, login, tick, sleep } from "./lib.mjs";

await phase("P1 FULL PRODUCTION RUN");
const before = await snapshot();
printSnap(before, "t1-before");

const cookie = await login();
const t = await tick(cookie, 10, "&full=1");
ev("P1", `tickGen1(fullSweep,max=10): status=${t.status} ms=${t.ms} reply=${JSON.stringify(t.body).slice(0, 140)}`);
await sleep(75_000);
const after = await snapshot();
for (const d of delta(before, after)) ev("P1", `DELTA ${d}`);

const recent = await q2(`SELECT type, status, priority, attempts, "completedAt", LEFT(result::text,120) AS result
  FROM "Job" WHERE "createdAt" > NOW() - INTERVAL '8 minutes' ORDER BY priority DESC, "createdAt" ASC LIMIT 16`);
for (const r of recent.rows) ev("P1", `job ${r.type}/${r.status} prio=${r.priority} attempts=${r.attempts} done=${r.completedAt ? "Y" : "N"} :: ${(r.result ?? "").replace(/\n/g, " ").slice(0, 100)}`);

const nl = await q2(`SELECT l.id, l.score, l."sourcePlatform", b.name FROM "Lead" l
  LEFT JOIN "Business" b ON b.id=l."businessId" WHERE l."createdAt" > NOW() - INTERVAL '8 minutes' ORDER BY l.score DESC LIMIT 10`);
for (const r of nl.rows) ev("P1", `NEW LEAD score=${r.score} src=${r.sourcePlatform ?? "?"} :: ${(r.name ?? "").slice(0, 60)}`);

const t2 = await tick(cookie, 6);
ev("P1", `tickGen2: status=${t2.status}`);
await sleep(60_000);
const after2 = await snapshot();
for (const d of delta(after, after2)) ev("P1", `DELTA2 ${d}`);

async function q2(sql) {
  const { q } = await import("./lib.mjs");
  return q(sql);
}
process.exit(0);
