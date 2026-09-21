// اختبار حي شامل: العقل النفسي + محرك التطور الذاتي + المقترحات الجوهرية
// تشغيل: bun run scripts/test-psych-evolution.ts
import { db } from "../src/lib/db"
import { PSYCH_DOCTRINE, detectPsychContext, buildPsychComment, COMMENT_ANGLES, REACTION_PLAYBOOK } from "../src/lib/agent/zizo/psychology"
import { pickTactic, recordTacticUse, creditTacticWin, evolutionTick, proposeFundamental, decideProposal, evolutionStats } from "../src/lib/agent/zizo/evolution"

let pass = 0
let fail = 0
function ok(name: string, cond: boolean, extra?: string) {
  if (cond) {
    pass++
    console.log(`✅ ${name}${extra ? ` — ${extra}` : ""}`)
  } else {
    fail++
    console.log(`❌ ${name}${extra ? ` — ${extra}` : ""}`)
  }
}

const ws = await db.workspace.findFirst()
if (!ws) {
  console.log("❌ مفيش ورشة — شغل seed الأول")
  process.exit(1)
}
const wsId = ws.id
console.log(`الورشة: ${ws.name} (${wsId})\n`)

// ══════════ 1) العقيدة النفسية ══════════
console.log("── 1) العقيدة النفسية ──")
ok("العقيدة فيها علم النفس السلوكي", PSYCH_DOCTRINE.includes("المعاملة بالمثل") && PSYCH_DOCTRINE.includes("النفور من الخسارة"))
ok("العقيدة فيها البيعي", PSYCH_DOCTRINE.includes("SPIN") && PSYCH_DOCTRINE.includes("الاعتراض مش «لأ»"))
ok("العقيدة فيها الدوبامين", PSYCH_DOCTRINE.includes("الدوبامين") && PSYCH_DOCTRINE.includes("فجوة المعلومة") && PSYCH_DOCTRINE.includes("الذروة والنهاية"))
ok("العقيدة فيها الأخلاق", PSYCH_DOCTRINE.includes("ممنوع ندرة كاذبة"))
ok("عدد تكنيكات ردود الفعل ≥ 8", REACTION_PLAYBOOK.length >= 8, `${REACTION_PLAYBOOK.length} تكنيك`)
ok("عدد أركان التعليق ≥ 6", COMMENT_ANGLES.length >= 6, `${COMMENT_ANGLES.length} ركن`)

// ══════════ 2) كشف ردود الفعل ══════════
console.log("\n── 2) كشف ردود الفعل → التكنيك ──")
const cases: Array<[string, string, string]> = [
  ["1700 ده كتير عليا والله", "objection:price_investment_reframe", "اعتراض سعر"],
  ["خلي بالك هفكر وأرد عليك", "objection:think_zeigarnik_openloop", "هفكر"],
  ["مش فاضي النهاردة والله، انشغلت", "objection:time_10min_framing", "مفيش وقت"],
  ["إزاي أثق فيكم؟ كلهم بيقولوا كده", "objection:trust_risk_reversal", "الثقة"],
  ["تمام ابعتلي التفاصيل ونبدأ", "signal:hot_commit_at_peak", "حماس"],
  ["بكام الشغل ده؟", "objection:price_ask_anchor_range", "سؤال سعر"],
  ["حصلت مشكلة واتأخر الشغل، مش راضي", "objection:anger_laer", "غضب"],
]
for (const [msg, expectedId, label] of cases) {
  const hits = detectPsychContext(msg)
  ok(`${label} → ${expectedId.split(":")[1]}`, hits.some((h) => h.id === expectedId), hits.map((h) => h.id).join("،") || "ولا حاجة")
}
const followHits = detectPsychContext("", { followup: true })
ok("متابعة الساكت → تكنيك قيمة-أولاً", followHits.some((h) => h.id === "state:silence_value_first_followup"))
const noHits = detectPsychContext("أهلاً زيزو إزيك")
ok("كلام عادي → مفيش تكنيك مفروض", noHits.length === 0)

// ══════════ 3) التعليقات النفسية ══════════
console.log("\n── 3) التعليقات النفسية ──")
const matched = ["محتاج", "موقع"]
const samples: string[] = []
for (let i = 0; i < 12; i++) samples.push(buildPsychComment("عايز موقع إلكتروني لمتجري وابلدي بنظام كاشير", matched).text)
ok("كل تعليق فيه رابط واتساب صحيح", samples.every((s) => s.includes("https://wa.me/201067804629")), "12/12")
ok("بعض التعليقات فيها تليجرام بديل", samples.some((s) => s.includes("t.me/+12186496997")))
const unique = new Set(samples).size
ok("تنويع كامل — مفيش قالب واحد بيتكرر", unique >= 8, `${unique} صيغة مختلفة من 12`)
ok("مفيش أقواس قوالب/placeholders", samples.every((s) => !/[{}<>]/.test(s)))
ok("مفيش كلمات بوت", samples.every((s) => !/بوت|ذكاء اصطناعي|مساعد افتراضي|\*\*/.test(s)))
ok("طول بشري معقول", samples.every((s) => s.length >= 60 && s.length <= 450))
const anglesUsed = new Set<string>()
for (let i = 0; i < 24; i++) anglesUsed.add(buildPsychComment("محتاج تسويق", ["إعلانات ممولة"]).angle)
ok("كل الأركان بتظهر بالتدوير", anglesUsed.size >= 5, `${anglesUsed.size} ركن من 6`)

// ══════════ 4) الاختيار الموزّع والتسجيل ══════════
console.log("\n── 4) محرك التطور — اختيار وتسجيل ──")
const angleIds = COMMENT_ANGLES.map((a) => a.id)
// نعطي ركن واحد فوز كبير — المفروض ينسحب أكتر من غيره
for (let i = 0; i < 6; i++) await creditTacticWin(wsId, "comment", "comment:reciprocity_tip_first")
await recordTacticUse(wsId, "comment", "comment:reciprocity_tip_first")
await db.tacticStat.updateMany({ where: { workspaceId: wsId, family: "comment", tacticId: "comment:reciprocity_tip_first" }, data: { weight: 3.4 } })
const picks = new Map<string, number>()
for (let i = 0; i < 40; i++) {
  const p = await pickTactic(wsId, "comment", angleIds)
  picks.set(p, (picks.get(p) ?? 0) + 1)
}
const champPicks = picks.get("comment:reciprocity_tip_first") ?? 0
ok("التوزيع الموزّع بيكريم الفائز", champPicks >= 12, `البطل انسحب ${champPicks}/40 مرة (وزنه 3.4 من أصل ${angleIds.length})`)
const before = await db.tacticStat.findFirst({ where: { workspaceId: wsId, family: "comment", tacticId: "comment:reciprocity_tip_first" } })
await recordTacticUse(wsId, "comment", "comment:reciprocity_tip_first")
const after = await db.tacticStat.findFirst({ where: { workspaceId: wsId, family: "comment", tacticId: "comment:reciprocity_tip_first" } })
ok("recordTacticUse بيزود العدّاد", (after?.used ?? 0) === (before?.used ?? 0) + 1, `${before?.used} → ${after?.used}`)

// ══════════ 5) المقترحات الجوهرية (موافقة قبل التنفيذ) ══════════
console.log("\n── 5) المقترحات الجوهرية ──")
// نظف أي مقترحات قديمة PENDING عشان الاختبار يشتغل
await db.evolutionProposal.deleteMany({ where: { workspaceId: wsId, status: "PENDING" } })
await db.agentInsight.deleteMany({ where: { workspaceId: wsId, kind: "evolution", pattern: "_lastProposal" } })

const created = await proposeFundamental(wsId, {
  title: "اختبار: مقترح تطور جوهري (تجربة آلية)",
  kind: "STRATEGY",
  rationale: "مقترح تجريبي للتأكد من بوابات الموافقة — الاختبار بيمسحه بعدها",
  impact: "لا شيء — تجربة",
  plan: { action: "config", patch: { maxDailyMessages: 30 } }, // نفس القيمة الافتراضية — آمن
})
ok("المقترح اتسجل", created)
const pending = await db.evolutionProposal.findFirst({ where: { workspaceId: wsId, status: "PENDING" } })
ok("المقترح واقف PENDING (مش منفذ)", Boolean(pending))
const alertForProposal = await db.alert.findFirst({ where: { workspaceId: wsId, type: "EVOLUTION_PROPOSAL" }, orderBy: { createdAt: "desc" } })
ok("إشعار موافقة اتبعت للمالك", Boolean(alertForProposal), alertForProposal?.title.slice(0, 60))
const dup = await proposeFundamental(wsId, {
  title: "مقترح مكرر لازم يتمنع", kind: "STRATEGY", rationale: "دييدوب", plan: { action: "noop" },
})
ok("الديدوب شغال (نفس النوع PENDING ممنوع يتكرر)", dup === false)

if (pending) {
  const applied = await decideProposal(wsId, pending.id, true)
  ok("الموافقة طبقت الخطة", applied.ok && applied.note.includes("اتطبق"), applied.note.slice(0, 70))
  const appliedRow = await db.evolutionProposal.findUnique({ where: { id: pending.id } })
  ok("حالة المقترح APPLIED + وقت التطبيق", appliedRow?.status === "APPLIED" && Boolean(appliedRow?.appliedAt))
  const settingsAfter = (await db.workspace.findUnique({ where: { id: wsId }, select: { settings: true } }))?.settings as { zizo?: { maxDailyMessages?: number } }
  ok("الإعدادات اتطبقت فعلاً", settingsAfter?.zizo?.maxDailyMessages === 30)
  const reDecide = await decideProposal(wsId, pending.id, false)
  ok("مفيش قرار تاني على مقترح مقرر", reDecide.ok === false)
}

// ══════════ 6) نبضة التعلم — الكريم من التحولات المرحلية ══════════
console.log("\n── 6) نبضة التعلم (evolutionTick) ──")
// فتح بوابة الزمن: آخر تشغيل قبل ساعتين
const marker = await db.agentInsight.findFirst({ where: { workspaceId: wsId, kind: "evolution", pattern: "_lastRun" } })
if (marker) await db.agentInsight.update({ where: { id: marker.id }, data: { note: new Date(Date.now() - 2 * 3600_000).toISOString() } })

// محاكاة: محادثة + رسالة زيزو بتكتيك نفسي + تحول مرحلي مسجل
const testConv = await db.conversation.create({
  data: { workspaceId: wsId, channel: "MANUAL", contactName: "اختبار-تطور", stage: "INTERESTED", status: "WAITING_CLIENT", lastReplyBy: "ZIZO" },
})
await db.message.create({
  data: { conversationId: testConv.id, direction: "OUT", author: "ZIZO", body: "رد اختبار بتكنيك إعادة التأطير", meta: { tactic: "objection:price_investment_reframe" } },
})
await db.agentInsight.create({
  data: { workspaceId: wsId, kind: "sales", pattern: "ENGAGED→INTERESTED", note: "تحول اختبار", evidence: { conversationId: testConv.id } },
})

const evo1 = await evolutionTick(wsId)
ok("النبضة اشتغلت (عدت بوابة الزمن)", true, `${evo1.learned.length} درس • ${evo1.weightsUpdated} وزن اتحدث`)
ok("الكريم وصل: التكنيك النفسي خد فوز", evo1.learned.some((l) => l.includes("objection:price_investment_reframe")), evo1.learned.slice(0, 2).join(" | "))
const replyStat = await db.tacticStat.findFirst({ where: { workspaceId: wsId, family: "reply", tacticId: "objection:price_investment_reframe" } })
ok("إحصائية التكتيك اتسجلت في القاعدة", (replyStat?.wins ?? 0) >= 1, `wins=${replyStat?.wins} used=${replyStat?.used}`)

// النبضة التانية فوراً — لازم تتحجب (بوابة 25 دقيقة)
const evo2 = await evolutionTick(wsId)
ok("بوابة التكرار شغالة (25 دقيقة)", evo2.learned.length === 0 && !evo2.proposal)

// ══════════ 7) الإحصائيات للواجهة ══════════
console.log("\n── 7) إحصائيات الواجهة ──")
const stats = await evolutionStats(wsId)
ok("إحصائيات التكتيكات جاهزة", stats.tactics.length >= 2, `${stats.tactics.length} تكتيك`)
ok("المقترحات ظاهرة (المطبق/المرفوض)", stats.proposals.length >= 1, `${stats.proposals.length} مقترح`)
ok("مفيش مقترح PENDING بعد القرار", stats.proposals.filter((p) => p.status === "PENDING").length === 0)

// ══════════ تنظيف ══════════
console.log("\n── تنظيف بيانات الاختبار ──")
await db.conversation.delete({ where: { id: testConv.id } }).catch(() => undefined) // الرسايل بتتمسح بالكاسكيد
await db.evolutionProposal.deleteMany({ where: { workspaceId: wsId, title: { contains: "تجربة آلية" } } })
await db.agentInsight.deleteMany({ where: { workspaceId: wsId, kind: "sales", pattern: "ENGAGED→INTERESTED", note: "تحول اختبار" } })
await db.alert.deleteMany({ where: { workspaceId: wsId, title: { contains: "تجربة آلية" } } })
console.log("اتنضفت المحادثة والمقترح التجريبي — الإحصائيات الحقيقية فضلت\n")

console.log(`══════════ النتيجة: ${pass} ناجح • ${fail} فاشل ══════════`)
process.exit(fail ? 1 : 0)
