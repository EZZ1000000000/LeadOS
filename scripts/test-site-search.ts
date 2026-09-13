// Test: does web_search support site: operators for platform-specific discovery?
const ZAI = (await import("z-ai-web-dev-sdk")).default
const zai = await ZAI.create()

const tests = [
  "site:facebook.com القاهرة كافيه محتاج كاشير",
  "site:reddit.com Egypt business looking for web developer",
  "site:linkedin.com/posts مصر شركة توظيف مبرمج",
]

for (const q of tests) {
  try {
    const res = (await zai.functions.invoke("web_search", { query: q, num: 4, recency_days: 30 })) as Array<{ url: string; name: string; snippet: string }>
    console.log(`\n=== ${q} → ${res.length} results ===`)
    for (const r of res.slice(0, 3)) console.log(` - [${r.url.slice(0, 70)}] ${r.name?.slice(0, 60)}`)
  } catch (e) {
    console.log(`\n=== ${q} → ERROR: ${e}`)
  }
}
