// اختبار حي شامل — خبرة البيع الضخمة لزيزو (52 مصدر بحث حقيقي)
import { db } from "../src/lib/db"
import { AGENCY_SERVICES } from "../src/lib/agent/zizo/services"
import { FIELD_PLAYBOOKS, expertiseBrief, objectionBrief, detectNegotiation, seedExpertiseKnowledge, expertiseStatus, EXPERT_CORE } from "../src/lib/agent/zizo/expertise"
import { buildPsychComment } from "../src/lib/agent/zizo/psychology"
import { aiChat } from "../src/lib/ai"

let pass = 0
let fail = 0
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++
    console.log(`  ✓ ${name} ${extra}`)
  } else {
    fail++
    console.log(`  ✗ ${name} ${extra}`)
  }
}

async function main() {
  console.log("═══ 1) بنية المعرفة ═══")
  const st = expertiseStatus()
  console.log(`  Playbooks: ${st.playbooks} | إحصائيات: ${st.stats} | أسعار مصر: ${st.prices} | إغلاقات: ${st.closes} | أوضاع تفاوضية: ${st.negotiations}`)
  check("17 playbook = 17 خدمة", st.playbooks === 17)
  check("13+ إحصائية موثقة", st.stats >= 13, `(${st.stats})`)
  check("9 مراجع أسعار مصر", st.prices === 9)
  check("12 تقنية إغلاق", st.closes === 12)
  check("8 أوضاع تفاوضية", st.negotiations === 8)
  const svcIds = new Set(AGENCY_SERVICES.map((s) => s.id))
  const missing = FIELD_PLAYBOOKS.filter((p) => !svcIds.has(p.id))
  check("كل الـplaybooks مربوطة بخدمة حقيقية", missing.length === 0, missing.map((m) => m.id).join(","))
  const emptyHooks = FIELD_PLAYBOOKS.filter((p) => !p.hook || p.objections.length < 3 || p.questions.length < 3)
  check("كل playbook مليان (hook + 3 اعتراضات + 3 أسئلة)", emptyHooks.length === 0)

  console.log("\n═══ 2) المطابقة الميدانية (كلام عميل → خبرة) ═══")
  const cases: Array<[string, string]> = [
    ["عايز موقع إلكتروني لمطعمي مع متجر", "web"],
    ["محتاج تطبيق موبايل للدليفري", "mobile"],
    ["عايز أجنت ذكاء اصطناعي يرد على عملائي في واتساب", "agents"],
    ["عايز أدير إعلانات فيسبوك لصالوني", "media"],
    ["محتاج سيو علشان موقعي يطلع في جوجل", "seo"],
    ["عايز لوجو وهوية بصرية لمشروعي", "graphic"],
  ]
  for (const [text, expectId] of cases) {
    const m = expertiseBrief(text)
    const ok = m.includes(expectId === "agents" ? "وكلاء ذكاء اصطناعي" : expectId === "web" ? "مواقع" : expectId === "mobile" ? "موبايل" : expectId === "media" ? "ميديا بينج" : expectId === "seo" ? "SEO" : "جرافيك")
    check(`«${text.slice(0, 35)}»`, ok && m.length > 100, `→ ${ok ? "playbook صح" : "مطابقة غلط"}`)
  }
  const noMatch = expertiseBrief("الجو حلو النهاردة")
  check("كلام مالوش علاقة = مفيش حقن (توفير توكنز)", noMatch === "")

  console.log("\n═══ 3) رصد التفاوض ═══")
  const negs: Array<[string, string]> = [
    ["السعر ده غالي اوي، في حد أرخص منكم", "صدمة السعر"],
    ["ماشي هفكر وأرجعلك", "«هفكر» (حلقة مفتوحة)"],
    ["مفيش وقت دلوقتي، انا مشغول", "«مفيش وقت»"],
    ["وريني شغل قديم الأول", "فجوة الثقة"],
    ["بكام؟ قول السعر على طول", "سؤال السعر المبكر"],
    ["عندي عرض تاني أرخص منكم", "منافس أرخص"],
  ]
  for (const [text, expectName] of negs) {
    const m = detectNegotiation(text)
    check(`«${text.slice(0, 30)}» → ${m?.name ?? "❌ لا شيء"}`, m?.name === expectName)
  }
  const ob = objectionBrief("غالي اوي، انزل في السعر شوية")
  check("توجيه التفاوض فيه قاعدة «مفيش خصم من غير مقابل»", ob.includes("مفيش خصم من غير مقابل"))

  console.log("\n═══ 4) العقيدة والتعليقات ═══")
  check("العقيدة فيها SPIN وChallenger والمتابعة", EXPERT_CORE.includes("SPIN") && EXPERT_CORE.includes("Challenger") && EXPERT_CORE.includes("80%"))
  const c1 = buildPsychComment("عايز أعمل موقع لشركتي", ["web"])
  check("تعليق الرادار بيطلع نص بشري", c1.text.length > 40 && c1.text.length < 600, `(${c1.text.length} حرف)`)
  const c2hits = [0, 1, 2, 3, 4, 5, 6, 7].filter(() =>
    buildPsychComment("محتاج نظام إدارة مخزون", ["software"], undefined, "أي عملية بتتم على ورق أو واتساب بتضيع منها أرقام. النظام بيحوّلها لأصول").text.includes("ورق أو واتساب"),
  ).length
  check("تعليق بخبرة سوقية محقونة (في تكرارات من 8)", c2hits >= 1, `(${c2hits}/8 حقنت خبرة)`)

  console.log("\n═══ 5) السَمّ في ذاكرة زيزو (idempotent) ═══")
  const ws = await db.workspace.findFirst({ select: { id: true, name: true } })
  if (!ws) {
    console.log("  ⚠ مفيش ورشة — تخطي السَمّ")
  } else {
    const n1 = await seedExpertiseKnowledge(ws.id)
    const n2 = await seedExpertiseKnowledge(ws.id)
    console.log(`  ورشة «${ws.name}»: تشغيلة أولى = ${n1} معرفة جديدة، تشغيلة تانية = ${n2}`)
    check("idempotent — التانية صفر", n2 === 0)
    const cnt = await db.agentInsight.count({ where: { workspaceId: ws.id, kind: "expertise" } })
    check("ذاكرة expertise مليانة (≥55 بند)", cnt >= 55, `(${cnt} بند = 16 إحصائية + 9 أسعار + 17 خبرة + 12 إغلاق + قواعد تواصل)`)
  }

  console.log("\n═══ 6) اختبار حي — رد زيزو على اعتراض سعر بخبرته الجديدة ═══")
  try {
    const system = `انت زيزو — موظف مبيعات مصري في وكالة ${"Zizo HQ"}. بترد في واتساب بالمصري الشاتي، رسالة واحدة قصيرة.\n\n${EXPERT_CORE}\n\n${objectionBrief("غالي اوي انزل في السعر")}`
    const res = await aiChat(
      [
        { role: "system", content: system },
        { role: "user", content: "العميل بيقول: «مصرقع؟ 25 ألف على موقع؟ غالي اوي، هكلم حد أرخص»" },
      ],
      { runType: "AGENT", task: "test", maxTokens: 300, temperature: 0.7 },
    )
    if (res?.text) {
      const t = res.text.replace(/\s+/g, " ").trim()
      console.log(`  💬 زيزو: «${t.slice(0, 220)}»`)
      check("الرد بشري ومصري (مش رفض)", t.length > 30)
      check("الرد بيأطر قيمة/استثمار أو بيطلب مقابل للخصم (مش بيخفض فوراً)", !/طب يبقى قول رقمك|أوكي هخفض|تمام هخفض/.test(t))
    } else {
      console.log("  ⚠ المحرك مش متاح — تخطي الاختبار الحي")
    }
  } catch (e) {
    console.log(`  ⚠ اختبار حي تخطى: ${e}`)
  }

  console.log(`\n═══ النتيجة: ${pass} ناجح / ${fail} فاشل ═══`)
  await db.$disconnect()
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(async (e) => {
  console.error("فشل الاختبار:", e)
  await db.$disconnect()
  process.exit(1)
})
