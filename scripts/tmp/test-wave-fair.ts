/**
 * اختبار محلي حي: الموجة الكاملة بعد إصلاح الخنق
 * بتشغل runDiscovery بالأنواع الموسعة (زي جوبة إنتاج حقيقية) وتطبع المنصات اللي فعلًا أصطادت
 */
import { config } from "dotenv"
config({ path: "/home/z/my-project/.env.local", quiet: true })
config({ path: "/home/z/my-project/.env", quiet: true })

import { runDiscovery, expandSourceTypes, PLATFORM_SITES } from "../../src/lib/discovery"

async function main() {
  const declared = ["GOOGLE_SEARCH", "GOOGLE_MAPS"] // زي قاعدة إنتاج 1
  const types = expandSourceTypes(declared)
  console.log("=== الأنواع الموسعة ===")
  console.log(types.join(", "))
  console.log(`(${types.length} نوع: مجاني ${types.filter((t) => ["REDDIT", "TELEGRAM", "RSS"].includes(t)).length} + بحث ${types.length - types.filter((t) => ["REDDIT", "TELEGRAM", "RSS"].includes(t)).length})`)

  const queries = [
    "محتاج مبرمج لشركتي",
    "اريد مطور تطبيقات في مصر",
    "شركة تسويق رقمي تبحث عن عملاء",
  ]
  const t0 = Date.now()
  const { items, adaptersUsed } = await runDiscovery(types, queries, 4)
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n=== النتيجة (${secs}s) ===`)
  console.log(`عناصر: ${items.length}`)
  console.log(`المنصات اللي أصطادت فعلًا: ${adaptersUsed.join(" + ")}`)

  const expected = Object.keys(PLATFORM_SITES).length
  console.log(`\nالمنصات المبنية في المشروع: ${expected}`)
  const platformItems = new Map<string, number>()
  for (const i of items) {
    const p = (i.rawData as { platform?: string })?.platform ?? "web"
    platformItems.set(p, (platformItems.get(p) ?? 0) + 1)
  }
  console.log("التوزيع:", [...platformItems.entries()].map(([p, n]) => `${p}:${n}`).join(" | "))
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
