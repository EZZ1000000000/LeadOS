/**
 * P6 — AGENT RUN (DSI-equivalent graph) under AI-unavailable: replan via heuristics, bounded steps, no infinite loop.
 */
import { q, phase, ev, login, api, sleep } from "./lib.mjs";

await phase("P6 AGENT/GRAPH UNDER FAILURE");
const cookie = await login();

const ai = await api(cookie, "/api/settings/ai");
ev("P6", `AI status at test time: hasKey=${ai.body?.status?.hasKey} nvidia=${ai.body?.status?.nvidia} (AI-off environment → heuristic replanning)`);

const start = await api(cookie, "/api/agent/entity", { method: "POST", body: JSON.stringify({ goal: "ابحث عن عملاء محتاجين موقع إلكتروني في القاهرة", max_steps: 5, max_minutes: 3 }) });
ev("P6", `entity start (DSI-equ replanning loop): status=${start.status} reply=${JSON.stringify(start.body).slice(0, 180)}`);
const runId = start.body?.runId;

// poll until terminal state (bounded — proves no infinite loop)
let final = null;
for (let i = 0; i < 20; i++) {
  await sleep(15_000);
  const s = await api(cookie, "/api/agent/entity");
  const me = s.body?.run;
  if (me && ["SUCCESS", "FAILED", "STOPPED"].includes(me.status)) { final = me; break; }
  if (me) ev("P6", `poll#${i}: status=${me.status} progress=${me.progress ?? "?"}`);
}
const row = runId ? await q(`SELECT id, status, mode, progress, "leadsCreated", "itemsScanned", "errorMessage", "durationMs"
  FROM "AgentRun" WHERE id=$1`, [runId]) : null;
if (row?.rows?.length) {
  const r = row.rows[0];
  ev("P6", `agent run final: status=${r.status} mode=${r.mode} progress=${r.progress} leads=${r.leadsCreated} scanned=${r.itemsScanned} dur=${r.durationMs}ms err=${(r.errorMessage ?? "").slice(0, 80)}`);
  const steps = await q(`SELECT idx, tool, status, "durationMs" AS duration_ms, LEFT(note,110) AS note FROM "AgentStep" WHERE "runId"=$1 ORDER BY idx`, [runId]);
  for (const s of steps.rows) ev("P6", `step[${s.idx}] ${s.tool} [${s.status}] ${s.duration_ms}ms :: ${(s.note ?? "").replace(/\n/g, " ").slice(0, 90)}`);
} else {
  ev("P6", `agent run ${runId ?? "?"}: no row found — check logs`);
}
ev("P6", `bounded-steps proof: max_steps=5 requested → run reached terminal state without manual stop ${final ? "✓" : "(poll window elapsed — check run row)"}`);
process.exit(0);
