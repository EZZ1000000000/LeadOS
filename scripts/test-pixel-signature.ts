// اختبار بصمة البيكسلات الإعلانية على مواقع حية + Tavily مع مكتبات الإعلانات
import { config } from "dotenv"
config({ path: "/home/z/my-project/.env" })
config({ path: "/home/z/my-project/.env.vercel-check", override: true })

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

const PIXEL_SIGNATURES: Array<{ name: string; re: RegExp }> = [
  { name: "meta_pixel", re: /connect\.facebook\.net\/[^"']*\/fbevents\.js|fbq\s*\(\s*['"]init/i },
  { name: "google_ads", re: /googletagmanager\.com\/gtag\/js\?id=AW-|google_conversion_id|googlesyndication\.com|gtag\s*\(\s*['"]config['"]\s*,\s*['"]AW-/i },
  { name: "tiktok_pixel", re: /analytics\.tiktok\.com\/i18n\/pixel|ttq\.load\s*\(/i },
  { name: "linkedin_pixel", re: /snap\.licdn\.com\/li\.lms-analytics|_linkedin_partner_id/i },
  { name: "snapchat_pixel", re: /sc-static\.net\/scevent\.min\.js|snaptr\s*\(\s*['"]init/i },
  { name: "x_pixel", re: /static\.ads-twitter\.com\/uftt\.js|twq\s*\(\s*['"]init/i },
]

async function checkSite(name: string, url: string) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ar,en;q=0.8" }, signal: AbortSignal.timeout(12000) })
    if (!res.ok) return console.log(`   ${name}: HTTP ${res.status}`)
    const html = await res.text()
    const found = PIXEL_SIGNATURES.filter((p) => p.re.test(html)).map((p) => p.name)
    console.log(`   ${name} (${Math.round(html.length / 1024)}KB): ${found.length ? "💰 " + found.join(", ") : "—"}`)
  } catch (e) { console.log(`   ${name}: ❌ ${e instanceof Error ? e.message.slice(0, 80) : e}`) }
}

console.log("═ بصمة البيكسلات — مواقع مصرية حية")
await checkSite("طلبات (طعام)", "https://www.talabat.com/egypt")
await checkSite("بيت.كوم عربي", "https://www.wadi-eg.com")
await checkSite("Jumia مصر", "https://www.jumia.com.eg")
await checkSite("متجر صغير (OLX)", "https://www.olx.com.eg")

// Tavily مع مكتبات الإعلانات
const tvKey = process.env.TAVILY_API_KEY
if (tvKey && !tvKey.includes("SENS")) {
  console.log("\n═ Tavily × مكتبات الإعلانات")
  for (const q of ["site:facebook.com/ads/library عقارات مصر", "site:adstransparency.google.com مصر اعلان"]) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${tvKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, max_results: 5, search_depth: "basic" }),
        signal: AbortSignal.timeout(20000),
      })
      const data = await res.json() as { results?: Array<{ url: string; title: string }> }
      console.log(`   "${q}" → ${(data.results ?? []).length} نتايج`)
      for (const r of (data.results ?? []).slice(0, 3)) console.log(`      ${r.url.slice(0, 90)}`)
    } catch (e) { console.log(`   ❌ ${e instanceof Error ? e.message : e}`) }
  }
}
