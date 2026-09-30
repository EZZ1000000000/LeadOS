// تشخيص حي: المنصات الفاضية الستة — بتعدي إيه؟ (ادابتير صفر ولا ابتلاع بيرفض؟)
// تشغيل: bun scripts/tmp/test-skill-adapters.ts
import { runDiscovery, PLATFORM_QUERY_SHAPES } from "@/lib/discovery"

const TARGETS = ["TELEGRAM", "JOBS", "ADS_LIBRARY", "EVENTS", "QUORA", "DISCORD"]
const NICHE = "سيستم كاشير للمطاعم في مصر"

console.log("=== أشكال الاستعلامات لكل منصة ===")
for (const t of TARGETS) {
  console.log(t, "→", PLATFORM_QUERY_SHAPES[t] ? PLATFORM_QUERY_SHAPES[t].shape("كاشير مطاعم").join(" | ") : "(مفيش شكل!)")
}

const t0 = Date.now()
const { items, adaptersUsed } = await runDiscovery(TARGETS, [NICHE], 6, { maxSearches: 14, passes: 3 })

const byType = new Map<string, typeof items>()
for (const it of items) {
  const arr = byType.get(it.viaType ?? "?") ?? []
  arr.push(it)
  byType.set(it.viaType ?? "?", arr)
}

console.log(`\n=== النتيجة (${items.length} عنصر في ${((Date.now() - t0) / 1000).toFixed(1)}s) — adapters: ${adaptersUsed.join(", ") || "none"} ===`)
for (const t of TARGETS) {
  const arr = byType.get(t) ?? []
  console.log(`\n[${t}] ${arr.length} عنصر`)
  for (const it of arr.slice(0, 3)) {
    console.log(`  • ${it.title.slice(0, 80)}`)
    console.log(`    ${it.url.slice(0, 90)}`)
    console.log(`    viaQuery="${(it.viaQuery ?? "").slice(0, 60)}"`)
  }
}
