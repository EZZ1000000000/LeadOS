// LeadOS — اختبار حي لراوتر dahl داخل طبقة الـ AI الرسمية (ai.ts)
// بيتأكد: dahl بيشتغل كمزود أساسي + stripThink + JSON استخراج + تسجيل AiRun
import { aiChat, aiChatJson, aiProviderStatus } from "../src/lib/ai"

async function main() {
  const status = aiProviderStatus()
  console.log("=== حالة المزود ===")
  console.log("dahl active:", status.dahl?.active, "| keys:", status.dahl?.keys, "| base:", status.dahl?.base)
  console.log("note:", status.note)

  console.log("\n=== اختبار 1: صياغة بيعية (compose) ===")
  const compose = await aiChat(
    [
      { role: "system", content: "أنت زيزو — وكيل مبيعات مصري بيتكلم عامية مصرية ودود وواثق." },
      { role: "user", content: "اكتب رد واتساب قصير (سطرين) لصاحب محل قال «عايز نظام كاشير بس مش غالي»" },
    ],
    { task: "compose", maxTokens: 300 },
  )
  console.log(`[${compose?.provider}/${compose?.model}] ${compose?.latencyMs}ms`)
  console.log(compose?.text?.slice(0, 250))

  console.log("\n=== اختبار 2: تصنيف JSON (classify) ===")
  const cls = await aiChatJson<{ intent: string; urgency: string }>(
    [
      { role: "system", content: 'مصنف صارم — رد JSON فقط بالشكل: {"intent":"buy_now|researching|noise","urgency":"high|medium|low"}' },
      { role: "user", content: "محتاج مطبعة تطلعلي 5000 بروشور قبل الكريسماس ضروري، بكام؟" },
    ],
    { task: "classify", maxTokens: 250 },
  )
  console.log("JSON الناتج:", JSON.stringify(cls))

  console.log("\n=== اختبار 3: تأهيل ليد (qualify) ===")
  const q = await aiChat(
    [{ role: "user", content: "قيّم الليد ده من 100 لبيعة أنظمة POS: صاحب سلسلة 3 مطاعم في المنصورة، شاكي انهيار الكاشير يوم الجمعة، بيسأل عن الأسعار في جروب أصحاب مطاعم. رد سطرين: السكور + السبب." }],
    { task: "qualify", maxTokens: 200 },
  )
  console.log(`[${q?.provider}/${q?.model}] ${q?.latencyMs}ms`)
  console.log(q?.text?.slice(0, 200))

  if (!compose || !cls || !q) {
    console.error("\n❌ فشل راوتر — فيه مهمة رجعت null")
    process.exit(1)
  }
  if (compose.provider !== "DAHL" || q.provider !== "DAHL") {
    console.error("\n⚠️ الراوتر مش ماشي على dahl — راجع الأولويات")
    process.exit(1)
  }
  console.log("\n✅ راوتر dahl شغال 100%")
  process.exit(0)
}

main()
