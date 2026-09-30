// اختبار سريع: الأسئلة المخصصة للمنصات + الموجة الموسعة + المسح الشامل
import { platformQueries, expandSourceTypes } from "@/lib/discovery"

const base = "كافيهات مدينة نصر"
for (const p of ["JOBS", "MARKETPLACE", "QUORA", "EVENTS", "ADS_LIBRARY", "X", "TIKTOK", "YOUTUBE", "DIRECTORY", "REVIEWS", "DISCORD", "FACEBOOK", "INSTAGRAM", "LINKEDIN", "FREELANCE"]) {
  console.log(p.padEnd(12), "→", JSON.stringify(platformQueries(p, base)))
}
// استعلام نية — لازم يتشال السابقة ويبقى الموضوع بس
console.log("INTENT       →", JSON.stringify(platformQueries("MARKETPLACE", "محتاج سيستم كاشير")))

// الموجة العادية (قاعدة = GOOGLE_SEARCH + GOOGLE_MAPS): 2 مجاني + 2 قاعدة + 4 موجة
const wave = expandSourceTypes(["GOOGLE_SEARCH", "GOOGLE_MAPS"])
console.log("\nWAVE(", wave.length, "):", wave.join(", "))

// المسح الشامل: كل المنصات
const full = expandSourceTypes(["GOOGLE_SEARCH", "GOOGLE_MAPS"], { all: true })
console.log("FULL(", full.length, "):", full.join(", "))
