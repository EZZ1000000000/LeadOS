// اختبار SerpAPI: هل فيه رصيد + بيرجع ads؟
import { config } from "dotenv"
config({ path: "/home/z/my-project/.env" })
config({ path: "/home/z/my-project/.env.vercel-check", override: true })

const key = process.env.SERPAPI_API_KEY
if (!key || key.includes("SENS")) { console.error("NO REAL SERPAPI KEY"); process.exit(1) }

const queries = ["تأجير سيارات مصر", "استضافة مواقع", "دورة تسويق رقمي", "عيادة تجميل القاهرة"]
for (const q of queries) {
  const params = new URLSearchParams({ engine: "google", q, num: "10", gl: "eg", hl: "ar", google_domain: "google.com.eg", location: "Egypt", api_key: key })
  try {
    const res = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(20000) })
    console.log(`\n🔍 "${q}" [HTTP ${res.status}]`)
    if (!res.ok) { console.log(`   [${(await res.text()).slice(0, 150)}]`); continue }
    const data = await res.json() as {
      ads?: Array<{ title?: string; link?: string; displayed_link?: string; block_position?: string }>
      organic_results?: unknown[]
      error?: string
      serpapi_pagination?: unknown
    }
    if (data.error) { console.log(`   [API error: ${data.error}]`); continue }
    const ads = data.ads ?? []
    console.log(`   ads=${ads.length}  organic=${(data.organic_results ?? []).length}`)
    for (const a of ads.slice(0, 4)) console.log(`   💰 "${(a.title ?? "").slice(0, 55)}" → ${a.displayed_link ?? a.link}`)
  } catch (e) {
    console.log(`   ❌ ${e instanceof Error ? e.message : e}`)
  }
}
