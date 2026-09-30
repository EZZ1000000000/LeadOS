// إعادة إنتاج نداء التصنيف بالظبط (نفس البرومبت والحدود) — تشخيص فشل الصامت
import { aiChat } from "@/lib/ai"
import { classifyContent } from "@/lib/classification"

const t0 = Date.now()
const r = await aiChat(
  [
    { role: "user", content: "كافيه للبيع - عقارات في مصر الجديدة. المحل مجهز كاشير وكراسي. السعر 800 الف جنيه." },
  ],
  { task: "classify", maxTokens: 500, temperature: 0.1 },
)
console.log(`raw aiChat: ${r ? `OK ${r.provider} ${r.model} ${(Date.now() - t0)}ms` : `NULL بعد ${Date.now() - t0}ms`}`)
if (r) console.log("text:", r.text.slice(0, 200))

const t1 = Date.now()
const c = await classifyContent("ws-test", "كافيه للبيع - عقارات في مصر الجديدة", "المحل مجهز كاشير وسيتات. السعر 800 الف جنيه.")
console.log(`classifyContent: engine=${c.engine} (${Date.now() - t1}ms)`)
console.log("  is_lead:", c.classification.is_lead, "| intent:", c.classification.intent, "| score:", c.classification.score, "| reason:", c.classification.reason)
