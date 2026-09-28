// اختبار serp-scrape محليًا: Bing مباشر + ZenRows
import { searchBingDirect, searchBingViaZenrows } from "../src/lib/serp-scrape"

process.env.ZENROWS_API_KEYS = [
  "***REMOVED***",
  "***REMOVED***",
  "***REMOVED***",
].join(",")

async function main() {
  console.log("=== 1) Bing مباشر ===")
  try {
    const r1 = await searchBingDirect("site:linkedin.com/in عيادة أسنان القاهرة", 10)
    console.log(`Bing مباشر: ${r1.length} نتيجة`)
    for (const r of r1.slice(0, 4)) console.log(`  • ${r.name.slice(0, 55)} → ${r.host_name}`)
  } catch (e) {
    console.log("Bing مباشر فشل:", e instanceof Error ? e.message : e)
  }

  console.log("\n=== 2) Bing عبر ZenRows (كريدت 1) ===")
  try {
    const r2 = await searchBingViaZenrows("site:facebook.com مطاعم الجيزة", 10)
    console.log(`ZenRows→Bing: ${r2.length} نتيجة`)
    for (const r of r2.slice(0, 4)) console.log(`  • ${r.name.slice(0, 55)} → ${r.host_name}`)
  } catch (e) {
    console.log("ZenRows فشل:", e instanceof Error ? e.message : e)
  }

  console.log("\n=== 3) استعلام عربي كامل على Bing ===")
  try {
    const r3 = await searchBingDirect("محتاجين خدمات تسويق رقمي مصر", 10)
    console.log(`عربي: ${r3.length} نتيجة`)
    for (const r of r3.slice(0, 3)) console.log(`  • ${r.name.slice(0, 55)} | snippet: ${r.snippet.slice(0, 60)}`)
  } catch (e) {
    console.log("عربي فشل:", e instanceof Error ? e.message : e)
  }
}

main()
