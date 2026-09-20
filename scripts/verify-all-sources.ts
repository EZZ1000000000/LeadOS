// التحقق الحي الشامل: اختبار كل نوع مصدر واحد واحد ببيانات حقيقية
// الناتج: تقرير واضح — أنهي مصدر شغال وأنهي لأ
import { runDiscovery } from "../src/lib/discovery"

const TESTS: Array<{ type: string; query: string }> = [
  { type: "FACEBOOK", query: "محتاج مبرمج مصر" },
  { type: "LINKEDIN", query: "hiring marketing manager Egypt" },
  { type: "X", query: "عايز شركة تسويق مصر" },
  { type: "REDDIT", query: "looking for developer recommendation" },
  { type: "INSTAGRAM", query: "براند بيع اونلاين مصر" },
  { type: "TIKTOK", query: "متجر اونلاين مصر" },
  { type: "YOUTUBE", query: "شركة مصرية مراجعة نظام" },
  { type: "TELEGRAM", query: "شركات مصرية توسع استثمار" },
  { type: "GOOGLE_SEARCH", query: "محتاج نظام كاشير مطعم" },
  { type: "WEBSITE", query: "شركة مصرية توظف مدير تقنية" },
  { type: "NEWS", query: "شركة مصرية تفتح فروع جديدة" },
  { type: "RSS", query: "شركات مصرية استثمار توسع" },
  { type: "DIRECTORY", query: "مطاعم القاهرة" },
  { type: "JOBS", query: "مطلوب مبرمج مصر" },
  { type: "MARKETPLACE", query: "محتاج نظام لمحل مصر" },
  { type: "FREELANCE", query: "مطلوب مطور موقع مشروع" },
  { type: "ADS_LIBRARY", query: "شركة تعلن خدماتها مصر" },
  { type: "REVIEWS", query: "أفضل مطاعم القاهرة" },
  { type: "EVENTS", query: "معرض Cairo ICT شركات" },
  { type: "QUORA", query: "أفضل شركة برمجة في مصر" },
  { type: "DISCORD", query: "startup community Egypt discord" },
  { type: "GOOGLE_MAPS", query: "مطاعم القاهرة الجديدة" }, // متوقع صفر بأمانة — مفيش مفتاح
]

const results: Array<{ type: string; n: number; adapters: string; sample: string; ms: number }> = []
let ok = 0
for (const t of TESTS) {
  const t0 = Date.now()
  try {
    const { items, adaptersUsed } = await runDiscovery([t.type], [t.query], 4)
    const ms = Date.now() - t0
    const sample = items[0] ? items[0].title.slice(0, 55) : "—"
    results.push({ type: t.type, n: items.length, adapters: adaptersUsed.join(",") || "none", sample, ms })
    if (items.length > 0) ok++
    console.log(`${items.length > 0 ? "✅" : "⬛"} ${t.type.padEnd(13)} items=${items.length}  [${adaptersUsed.join(",") || "none"}]  ${sample}`)
  } catch (e) {
    const ms = Date.now() - t0
    results.push({ type: t.type, n: -1, adapters: "ERROR", sample: e instanceof Error ? e.message.slice(0, 60) : "err", ms })
    console.log(`❌ ${t.type.padEnd(13)} ERROR ${e instanceof Error ? e.message.slice(0, 60) : e}`)
  }
  await new Promise((r) => setTimeout(r, 800))
}

console.log("\n═══════ الخلاصة ═══════")
const working = results.filter((r) => r.n > 0)
const zero = results.filter((r) => r.n === 0)
const failed = results.filter((r) => r.n === -1)
console.log(`✅ شغال: ${working.length}/${results.length} (${working.map((r) => r.type).join(", ")})`)
if (zero.length) console.log(`⬛ صفر (نتايج مفيش دلوقتي): ${zero.map((r) => r.type).join(", ")}`)
if (failed.length) console.log(`❌ فشل: ${failed.map((r) => r.type).join(", ")}`)
console.log(`المجموع الكلي: ${results.reduce((s, r) => s + Math.max(0, r.n), 0)} نتيجة حقيقية`)
