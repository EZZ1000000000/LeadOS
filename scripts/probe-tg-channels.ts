// فحص قنوات تليجرام مصرية مرشحة — نشوف أنهي قنوات موجودة فعلاً وفيها بوستات
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

const CANDIDATES = [
  "EGBusiness", "egyptbusiness", "StartupsEG", "startups_egypt", "EgyptStartups",
  "RiseUpSummit", "entrepreneurEgypt", "economyEgypt", "MasrEconomy", "egyeconomy",
  "ITPEgypt", "egypreneur", "Cairotech", "cairotech", "TechEgypt", "techeg",
  "WamdaMedia", "menabytes", "EnterpriseME", "enterpriseME",
  "ElMalNews", "elmalnews", "AlBorsaNews", "alborsaanews", "AmwalAlGhad",
  "DailyNewsEgypt", "dailynewsegypt", "AhramEconomy", "ahrameconomy",
  "Fribaat", "wadiNegma", "trendegt", "TrendEG", "egyptianstreets",
]

const results: Array<[string, number]> = []
for (const ch of CANDIDATES) {
  try {
    const res = await fetch(`https://t.me/s/${ch}`, {
      headers: { "User-Agent": UA, "Accept-Language": "ar,en;q=0.8" },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()
    const posts = html.split('data-post="').length - 1
    if (posts > 0) results.push([ch, posts])
    console.log(`${ch}: posts=${posts}`)
  } catch (e) {
    console.log(`${ch}: FAIL`)
  }
}
console.log("\n=== LIVE CHANNELS ===")
console.log(JSON.stringify(results))
