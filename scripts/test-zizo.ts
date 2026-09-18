// اختبار زيزو الكيان البيعي — محادثة حقيقية عبر NVIDIA + طبقة البشرية
import { db } from "../src/lib/db"
import { openConversation, zizoReply, zizoTick, zizoStatus, zizoOutreach } from "../src/lib/agent/zizo/brain"
import { humanize } from "../src/lib/agent/zizo/humanize"
import { matchServices } from "../src/lib/agent/zizo/services"

let pass = 0
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "✓" : "✗"} ${label}`)
  if (cond) pass++
}

async function main() {
  console.log("═ UX 1: طبقة البشرية (بدون شبكة)")
  const h = humanize([
    "**أهلاً!** نحن نقدم لكم خدمات متكاملة تشمل:\n- تطبيقات موبايل\n- مواقع إلكترونية\nبص يا باشا أنا مساعد افتراضي ههههه",
    "طب مكالمة سريعة بكرة الساعة 3؟ ١٠ دقايق بس 👍",
    "   ",
  ])
  ok(h.msgs.length >= 2 && h.msgs.length <= 4, `تنظيف وتقسيم: ${h.msgs.length} رسايل`)
  ok(!h.msgs.some((m) => m.includes("**") || m.includes("مساعد افتراضي") || m.includes("\n")), "شيل التنسيق/البوت/الأسطر")
  ok(h.delaysMs.every((d) => d > 300 && d < 9000), `تأخيرات كتابة واقعية: ${h.delaysMs.map((d) => Math.round(d / 100) / 10 + "s").join(", ")}`)

  console.log("═ UX 2: مطابقة الخدمات")
  ok(matchServices("عايز تطبيق موبايل للدليفري").some((s) => s.id === "mobile"), "تطبيق موبايل → mobile")
  ok(matchServices("محتاج لوجو وهوية للبراند").some((s) => s.id === "graphic"), "لوجو → graphic")
  ok(matchServices("عايز اعلانات فيسبوك وجوجل").some((s) => s.id === "media"), "إعلانات → media")
  ok(matchServices("شات بوت يرد على العملاء").some((s) => s.id === "agents"), "شات بوت → agents")
  ok(matchServices("نظام إدارة مخازن كبير").some((s) => s.id === "software"), "نظام → software")

  console.log("═ UX 3: محادثة حقيقية (NVIDIA)")
  let ws = await db.workspace.findFirst()
  if (!ws) ws = await db.workspace.create({ data: { name: "وكالة الاختبار", slug: `test-${Date.now()}` } })
  ok(Boolean(ws), `ورشة: ${ws.name}`)

  const { id: convId } = await openConversation(ws.id, {
    contactName: "م. أحمد — مطعم البرجر بار",
    firstMessage: "مساء الخير، شفت اعلانكم. عندي مطعم في المعادي وعايز اعمل تطبيق دليفري خاص بيا، هو ده ممكن؟ وهل ده هيبقى غالي؟",
  })
  ok(Boolean(convId), `محادثة اتفتحت: ${convId.slice(0, 8)}`)

  const r1 = await zizoReply(ws.id, convId)
  ok(r1.ok && r1.msgs.length > 0, `رد زيزو الأول ${r1.ok ? "" : "(" + r1.note + ")"}: ${r1.msgs.map((m) => `«${m.slice(0, 60)}…»`).join(" + ")}`)
  ok(r1.stage === "ENGAGED" || r1.stage === "INTERESTED" || r1.stage === "OFFERED", `المرحلة بعد الرد: ${r1.stage}`)

  // رد العميل التاني — اعتراض سعر
  await db.message.create({ data: { conversationId: convId, direction: "IN", author: "CLIENT", body: "بص يا زيزو، الكلام حلو بس انا سامعت ان التطبيقات بتبدا من 150 الف؟ ده كتير عليا دلوقتي والوضع صعب" } })
  await db.conversation.update({ where: { id: convId }, data: { status: "NEEDS_REPLY" } })
  const r2 = await zizoReply(ws.id, convId)
  ok(r2.ok && r2.msgs.length > 0, `رد الاعتراض ${r2.ok ? "" : "(" + r2.note + ")"}: ${r2.msgs.map((m) => `«${m.slice(0, 60)}…»`).join(" + ")}`)

  // رد العميل التالت — موافقة على موعد
  await db.message.create({ data: { conversationId: convId, direction: "IN", author: "CLIENT", body: "طب تمام، بكرة بعد العصر الساعة 5 وقت مناسب؟" } })
  await db.conversation.update({ where: { id: convId }, data: { status: "NEEDS_REPLY" } })
  const r3 = await zizoReply(ws.id, convId)
  ok(r3.ok, `رد حجز الموعد: ${r3.msgs.map((m) => `«${m.slice(0, 50)}…»`).join(" + ")}`)
  const convFinal = await db.conversation.findUnique({ where: { id: convId } })
  ok(convFinal?.bookedAt != null, `محجوز لايف كول؟ ${convFinal?.bookedAt ? "✅ " + convFinal.bookedNote?.slice(0, 60) : "لأ"} | المرحلة: ${convFinal?.stage}`)

  console.log("═ UX 4: الحالة والنبض")
  const tick = await zizoTick(ws.id)
  ok(true, `نبضة: ${tick.note}`)
  const st = await zizoStatus(ws.id)
  ok(st.needsReply === 0 && st.booked >= 1, `الحالة بعد النبض: مفتوحة ${st.open} • مستنية رد ${st.needsReply} • محجوزة ${st.booked}`)

  console.log(`\nالنتيجة: ${pass} تأكيد ناجح`)
  await db.$disconnect()
}

main().catch((e) => {
  console.error("فشل الاختبار:", e)
  process.exit(1)
})
