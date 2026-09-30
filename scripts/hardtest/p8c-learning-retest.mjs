/** P8c — re-run learning verification after weight fix (real functions, real DB). */
import { q, ev, phase, envUrl } from "./lib.mjs";
import { execSync } from "node:child_process";
import fs from "node:fs";

await phase("P8c LEARNING RE-TEST (post-fix deploy)");
fs.writeFileSync("/home/z/my-project/scripts/hardtest/learning-run2.ts",
`import { recordTacticUse, creditTacticWin, pickTactic } from "../../src/lib/agent/zizo/evolution";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const ws = "cmuflg0190001mzaergkpgrze";
  const fam = "hardtest_comment2";
  const A = "ht_angle_A2", B = "ht_angle_B2";
  await recordTacticUse(ws, fam, A);
  await recordTacticUse(ws, fam, B);
  await creditTacticWin(ws, fam, A); await creditTacticWin(ws, fam, A);
  const stats = await db.tacticStat.findMany({ where: { workspaceId: ws, family: fam } });
  for (const s of stats) console.log("tactic", s.tacticId, "used=" + s.used, "wins=" + s.wins, "weight=" + s.weight);
  let aWin = 0, bWin = 0;
  for (let i = 0; i < 100; i++) { const p = await pickTactic(ws, fam, [A, B]); if (p === A) aWin++; else bWin++; }
  console.log("pickDistribution A=" + aWin + " B=" + bWin + " (A weight=2.0 vs B=1.0 → A should dominate ~72%)");
  await db.$disconnect();
}
main().catch((e) => { console.error("learn error:", String(e?.message ?? e).slice(0, 150)); process.exit(1); });`);

try {
  const out = execSync(`cd /home/z/my-project && DATABASE_URL="$HT_DB" npx --yes tsx scripts/hardtest/learning-run2.ts 2>&1 | grep -v Warning | tail -6`,
    { encoding: "utf8", timeout: 120_000, env: { ...process.env, HT_DB: envUrl() } });
  for (const line of out.split("\n").filter(Boolean)) ev("P8c", line.slice(0, 160));
} catch (e) {
  ev("P8c", "failed: " + String(e.message ?? e).slice(0, 150));
}
process.exit(0);
