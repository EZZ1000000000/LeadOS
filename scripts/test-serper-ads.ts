// اختبار حي: هل Serper بيرجع حقل ads (إعلانات ممولة) لاستعلامات مصرية؟
import { config } from "dotenv"
config({ path: "/home/z/my-project/.env" })
config({ path: "/home/z/my-project/.env.vercel-check", override: true })

const key = process.env.SERPER_API_KEY
if (!key) { console.error("NO SERPER KEY"); process.exit(1) }

const queries = [
  "سيستم كاشير للمطاعم مصر",
  "اعلان عقارات مصر",
  "(site:facebook.com OR site:instagram.com) كافيهات القاهرة مصر",
]
let totalAds = 0
for (const q of queries) {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q, num: 10, gl: "eg", hl: "ar" }),
    })
    console.log(`   [HTTP ${res.status}]`)
    if (!res.ok) { console.log(`   [body: ${(await res.text()).slice(0, 200)}]`); continue }
    const data = await res.json() as { ads?: Array<{ title?: string; link?: string; displayed_link?: string }>; organic?: unknown[] }
    const ads = data.ads ?? []
    totalAds += ads.length
    console.log(`\n🔍 "${q}"`)
    console.log(`   ads=${ads.length}  organic=${(data.organic ?? []).length}`)
    for (const a of ads.slice(0, 3)) console.log(`   💰 "${(a.title ?? "").slice(0, 60)}" → ${a.displayed_link ?? a.link}`)
  } catch (e) {
    console.log(`❌ "${q}":`, e instanceof Error ? e.message : e)
  }
}
console.log(`\n=== TOTAL ADS: ${totalAds} من ${queries.length} استعلامات ===`)
