// Verify current state of open-source scraping/anti-detect tools
const ZAI = (await import("z-ai-web-dev-sdk")).default
const zai = await ZAI.create()

const queries = [
  "Botasaurus github 2026 scraping framework anti-detection",
  "Camoufox vs Patchright vs Nodriver undetected browser 2026",
  "instagrapi maintained 2026 instagram session cookies",
  "twikit twitter scraper cookies free github 2026",
  "Crawlee fingerprint-suite session pool proxy rotation",
]

for (const q of queries) {
  try {
    const res = (await zai.functions.invoke("web_search", { query: q, num: 4, recency_days: 180 })) as Array<{ url: string; name: string; snippet: string }>
    console.log(`\n=== ${q} ===`)
    for (const r of res) console.log(`• ${r.name?.slice(0, 80)}\n  ${r.url.slice(0, 80)}\n  ${r.snippet?.slice(0, 150)}`)
  } catch (e) {
    console.log(`\n=== ${q} → FAILED (${String(e).slice(0, 60)})`)
  }
  await new Promise((r) => setTimeout(r, 1500))
}
