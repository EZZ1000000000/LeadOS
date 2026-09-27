// اختبار المنصات الأربعة الباقية باستعلامات مناسبة لطبيعتها (مش استعلام نية شراء)
import { runDiscovery } from "../../src/lib/discovery"

const CASES: Array<{ p: string; q: string }> = [
  { p: "DIRECTORY", q: "مطعم في القاهرة الجديدة" },
  { p: "ADS_LIBRARY", q: "اعلانات ممولة متجر الكتروني" },
  { p: "EVENTS", q: "معرض تكنولوجيا وريادة أعمال مصر" },
  { p: "DISCORD", q: "discord سيرفر مبرمجي مصر" },
]

for (const { p, q } of CASES) {
  try {
    const { items, adaptersUsed } = await runDiscovery([p], [q], 3)
    const sample = items.slice(0, 2).map((i) => `«${i.title.slice(0, 50)}» → ${i.url.slice(0, 60)}`).join("\n    ")
    console.log(`✅ ${p.padEnd(12)} ${items.length} نتيجة [${adaptersUsed.join(",") || "none"}]\n    ${sample || "—"}`)
  } catch (err) {
    console.log(`❌ ${p}: ${err instanceof Error ? err.message.slice(0, 80) : err}`)
  }
  await new Promise((r) => setTimeout(r, 1200))
}
