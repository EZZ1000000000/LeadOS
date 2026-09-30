/**
 * P7 — ZIZO RUNTIME continuity: open conversation on a real lead → incoming message → reply → state → next tick sees it.
 */
import { q, phase, ev, login, api } from "./lib.mjs";

await phase("P7 ZIZO RUNTIME");
const cookie = await login();

// pick a real qualified lead
const lead = await q(`SELECT l.id, b.name FROM "Lead" l LEFT JOIN "Business" b ON b.id=l."businessId"
  WHERE l.score >= 40 ORDER BY l.score DESC LIMIT 1`);
const L = lead.rows[0];
ev("P7", `target lead: ${L.id.slice(-6)} :: ${(L.name ?? "").slice(0, 50)} score-in-DB`);

const open = await api(cookie, "/api/agent/zizo", { method: "POST", body: JSON.stringify({ action: "open", leadId: L.id, channel: "MANUAL", contactName: L.name ?? "HardTest", firstMessage: "بعد إذن حابب أعرف تفاصيل خدمة النظام؟" }) });
ev("P7", `open conversation: status=${open.status} reply=${JSON.stringify(open.body).slice(0, 200)}`);
const convId = open.body?.id ?? open.body?.conversation?.id;

if (convId) {
  const c1 = await q(`SELECT status, "lastMsgAt" AS lastMessageAt FROM "Conversation" WHERE id=$1`, [convId]);
  ev("P7", `conversation state after open+auto-reply: status=${c1.rows[0]?.status}`);
  const msg1 = await q(`SELECT direction, COUNT(*)::int AS c FROM "Message" WHERE "conversationId"=$1 GROUP BY 1`, [convId]);
  ev("P7", `messages by direction: ${msg1.rows.map(r => `${r.direction}=${r.c}`).join(" ")}`);

  // customer message already delivered via firstMessage — zizo tick must see and act
  const t = await api(cookie, "/api/agent/zizo", { method: "POST", body: JSON.stringify({ action: "tick" }) });
  ev("P7", `zizo tick: ${JSON.stringify(t.body).slice(0, 200)}`);

  const c2 = await q(`SELECT status FROM "Conversation" WHERE id=$1`, [convId]);
  const msg2 = await q(`SELECT direction, COUNT(*)::int AS c FROM "Message" WHERE "conversationId"=$1 GROUP BY 1`, [convId]);
  ev("P7", `state after tick: status=${c2.rows[0]?.status} messages=${msg2.rows.map(r => `${r.direction}=${r.c}`).join(" ")} → continuity ${msg2.rows.length ? "✓" : "✗"}`);
} else {
  ev("P7", `open failed — inspect reply above`);
}
process.exit(0);
