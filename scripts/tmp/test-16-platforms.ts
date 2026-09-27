// اختبار حي لكل منصات الاكتشاف الـ17 — منصة منصة: بتجيب عملاء ولا لأ؟
// بيستخدم سلسلة المزودين الحقيقية (serper → tavily → ... → zai) — محليًا ز-ai هو اللي هيشتغل
import { runDiscovery } from "../../src/lib/discovery"

const CLIENT_QUERY = "محتاج مبرمج يعمل موقع وتطبيق لبيزنسي في مصر"

const PLATFORMS = [
  "FACEBOOK", "INSTAGRAM", "X", "LINKEDIN", "REDDIT", "TIKTOK", "YOUTUBE",
  "DIRECTORY", "JOBS", "MARKETPLACE", "TELEGRAM", "FREELANCE",
  "ADS_LIBRARY", "REVIEWS", "EVENTS", "QUORA", "DISCORD",
] as const

const results: Array<{ p: string; n: number; sample: string; adapters: string }> = []

for (const p of PLATFORMS) {
  const t0 = Date.now()
  try {
    const { items, adaptersUsed } = await runDiscovery([p], [CLIENT_QUERY], 3)
    const sample = items
      .slice(0, 2)
      .map((i) => `«${i.title.slice(0, 55)}»`)
      .join(" | ")
    results.push({ p, n: items.length, sample: sample || "—", adapters: adaptersUsed.join(",") || "none" })
    console.log(`✅ ${p.padEnd(12)} ${String(items.length).padStart(2)} نتيجة (${((Date.now() - t0) / 1000).toFixed(1)}s) [${adaptersUsed.join(",") || "none"}] ${sample ? "→ " + sample.slice(0, 110) : ""}`)
  } catch (err) {
    results.push({ p, n: -1, sample: err instanceof Error ? err.message.slice(0, 90) : "خطأ", adapters: "error" })
    console.log(`❌ ${p.padEnd(12)} خطأ: ${err instanceof Error ? err.message.slice(0, 90) : err}`)
  }
  await new Promise((r) => setTimeout(r, 4000)) // إيقاع واقعي زي النبضة الإنتاجية — عشان مفيش 429
}

console.log("\n════════ الخلاصة ════════")
const ok = results.filter((r) => r.n > 0)
const empty = results.filter((r) => r.n === 0)
const failed = results.filter((r) => r.n < 0)
console.log(`شغالين وبيجيبوا: ${ok.length}/${results.length}`)
for (const r of empty) console.log(`  فاضي دلوقتي: ${r.p} [${r.adapters}] — البحث مارجعش نتايج`)
for (const r of failed) console.log(`  فشل: ${r.p} — ${r.sample}`)
