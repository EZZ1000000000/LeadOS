// اختبار حي: محرك سرقة إعلانات المنافسين من كل مكتبات الإعلانات
// ميتا (فب+انستجرام) + جوجل/يوتيوب (adstransparency) + تيك توك + لينكدإن
// بيمشي على نفس مسار الإنتاج: runDiscovery(["ADS_LIBRARY"]) بأسلوبين — نيش عام + اسم منافس
import { runDiscovery, competitorAdQueries } from "../../src/lib/discovery"

async function main() {
  const t0 = Date.now()

  // 1) اختبار النيش العام: أشكال الإعلانات الجديدة (اعلانات / اعلان ممول)
  console.log("── اختبار 1: نيش عام «متاجر اونلاين» على كل المكتبات ──")
  const r1 = await runDiscovery(
    ["ADS_LIBRARY"],
    ["متاجر اونلاين اعلانات", "متاجر اونلاين اعلان ممول"],
    5,
    { maxSearches: 4, passes: 1 },
  )
  console.log(`adapters: ${r1.adaptersUsed.join(", ") || "none"}`)
  for (const it of r1.items.slice(0, 6)) {
    console.log(` • [${it.viaType}] ${it.title.slice(0, 90)} → ${it.url.slice(0, 80)}`)
  }

  // 2) اختبار وضع السرقة: اسم منافس افتراضي (زي ما هيتولد من جدول المنافسين)
  console.log("\n── اختبار 2: وضع السرقة — «كاشير اونلاين» كمنافس افتراضي ──")
  const adPoach = competitorAdQueries(["كاشير اونلاين"])
  console.log(`queries: ${adPoach.join(" | ")}`)
  const r2 = await runDiscovery(
    ["ADS_LIBRARY"],
    adPoach,
    5,
    { maxSearches: 4, passes: 1 },
  )
  console.log(`adapters: ${r2.adaptersUsed.join(", ") || "none"}`)
  for (const it of r2.items.slice(0, 6)) {
    console.log(` • [${it.viaType}] ${it.title.slice(0, 90)} → ${it.url.slice(0, 80)}`)
  }

  console.log(`\nالنتيجة: اختبار1=${r1.items.length} عنصر، اختبار2=${r2.items.length} عنصر — ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

main().catch((e) => {
  console.error("TEST FAILED:", e instanceof Error ? e.message : e)
  process.exit(1)
})
