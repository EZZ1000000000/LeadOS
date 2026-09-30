/**
 * P8 — MEMORY LOOP + LEARNING LOOP (real functions, real DB).
 * Memory: agent run A (unique goal) → saves SearchMemory; run B (same goal) → reuse (hitCount+1, no web).
 * Learning: recordTacticUse/creditTacticWin → weight; pickTactic distribution favors winner.
 */
import { q, phase, ev, login, api, sleep } from "./lib.mjs";
import { execSync } from "node:child_process";
import { envUrl } from "./lib.mjs";

await phase("P8 MEMORY + LEARNING");
const cookie = await login();
const GOAL = "مطاعم في المنصورة محتاجة نظام كاشير حاردتست";

async function runOnce(label) {
  const start = await api(cookie, "/api/agent/run", { method: "POST", body: JSON.stringify({ objective: GOAL }) });
  const runId = start.body?.runId ?? start.body?.run?.id;
  ev("P8", `${label}: run started id=${runId?.slice(-6) ?? "?"} status=${start.status}`);
  for (let i = 0; i < 14; i++) {
    await sleep(15_000);
    const r = await q(`SELECT id, status, "reusedMemory", "memoryHits", "leadsCreated", "itemsScanned" FROM "AgentRun" WHERE id=$1`, [runId]);
    if (!r.rows.length) continue;
    if (["SUCCESS", "FAILED", "STOPPED"].includes(r.rows[0].status)) {
      const x = r.rows[0];
      ev("P8", `${label}: final status=${x.status} reusedMemory=${x.reusedMemory} memoryHits=${x.memoryHits} leads=${x.leadsCreated} scanned=${x.itemsScanned}`);
      return x;
    }
  }
  ev("P8", `${label}: still running after poll window`);
  return null;
}

const a = await runOnce("runA(first-sees-empty-memory)");
await sleep(5000);
const b = await runOnce("runB(same-goal→expect-memory-reuse)");

const mem = await q(`SELECT id, query, "hitCount", "leadCount", "qualityScore", "lastUsedAt" FROM "SearchMemory" WHERE query ILIKE '%المنصورة%' OR query ILIKE '%كاشير%' ORDER BY "lastUsedAt" DESC NULLS LAST LIMIT 4`);
for (const r of mem.rows) ev("P8", `searchMemory: ${(r.query ?? "").slice(0, 50)} hitCount=${r.hitCount} leads=${r.leadCount} quality=${r.qualityScore} lastUsed=${r.lastUsedAt?.toISOString?.().slice(11, 19)}`);
const reuse = a && b ? (b.reusedMemory ? "MEMORY REUSE ✓ (runB served from memory, hitCount incremented)" : "no reuse on runB ✗") : "runs incomplete";
ev("P8", `VERDICT ${reuse}`);

// ---- learning loop via REAL evolution functions
const child = `import { recordTacticUse, creditTacticWin, pickTactic } from "../../src/lib/agent/zizo/evolution";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const ws = "${"cmuflg0190001mzaergkpgrze"}";
  const fam = "hardtest_comment";
  const A = "ht_angle_A", B = "ht_angle_B";
  await recordTacticUse(ws, fam, A); await recordTacticUse(ws, fam, A);
  await recordTacticUse(ws, fam, B);
  await creditTacticWin(ws, fam, A); await creditTacticWin(ws, fam, A);
  const stats = await db.tacticStat.findMany({ where: { workspaceId: ws, family: fam } });
  for (const s of stats) console.log("tactic", s.tacticId, "used=" + s.used, "wins=" + s.wins, "weight=" + s.weight);
  let aWin = 0, bWin = 0;
  for (let i = 0; i < 60; i++) { const p = await pickTactic(ws, fam, [A, B]); if (p === A) aWin++; else bWin++; }
  console.log("pickDistribution A=" + aWin + " B=" + bWin + " (A has 2 wins -> should dominate)");
  await db.$disconnect();
}
main().catch((e) => { console.error("learn error:", String(e?.message ?? e).slice(0, 150)); process.exit(1); });`;
import fs from "node:fs";
fs.writeFileSync("/home/z/my-project/scripts/hardtest/learning-run.ts", child);
try {
  const out = execSync(`cd /home/z/my-project && DATABASE_URL="$HT_DB" npx --yes tsx scripts/hardtest/learning-run.ts 2>&1 | grep -v Warning | tail -8`, { encoding: "utf8", timeout: 120_000, env: { ...process.env, HT_DB: envUrl() } });
  for (const line of out.split("\n").filter(Boolean)) ev("P8", `learning: ${line.slice(0, 160)}`);
} catch (e) {
  ev("P8", `learning child failed: ${String(e.message ?? e).slice(0, 200)}`);
}
process.exit(0);
