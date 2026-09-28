// اختبار مباشر: مكتبات الإعلانات من السيرفر (زي ما Vercel هيلاقيها)
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

// 1) Google Ads Transparency Center — anon API (بدون مفاتيح)
async function testGoogleTransparency() {
  console.log("═ 1) adstransparency.google.com")
  try {
    // البحث بالكلمة المفتاحية عبر anon/async
    const url = `https://adstransparency.google.com/anon/async?hl=ar&region=EG&k=${encodeURIComponent("كاشير مطاعم")}&o=0&r=20&pkt=json`
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(15000) })
    const text = await res.text()
    console.log(`   [HTTP ${res.status}] len=${text.length}`)
    console.log(`   head: ${text.slice(0, 300).replace(/\n/g, " ")}`)
  } catch (e) { console.log(`   ❌ ${e instanceof Error ? e.message : e}`) }
}

// 2) Meta Ads Library — async search endpoint
async function testMetaAdsLibrary() {
  console.log("\n═ 2) facebook.com/ads/library async")
  try {
    const params = new URLSearchParams({
      session_id: Date.now().toString(),
      q: "كاشير",
      country: "EG",
      media_type: "all",
      active_status: "active",
      ad_type: "political_and_issue_ads",
      search_type: "keyword_unordered",
    })
    const res = await fetch(`https://www.facebook.com/ads/library/async/search_text/?${params}`, {
      headers: {
        "User-Agent": UA,
        "x-fb-friendly-name": "AdsLibrarySearchRequestEndpoint",
        "x-requested-with": "XMLHttpRequest",
        accept: "*/*",
        "accept-language": "ar,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    })
    const text = await res.text()
    console.log(`   [HTTP ${res.status}] len=${text.length}`)
    console.log(`   head: ${text.slice(0, 250).replace(/\n/g, " ")}`)
  } catch (e) { console.log(`   ❌ ${e instanceof Error ? e.message : e}`) }
}

// 3) TikTok Commercial Content Library (library.tiktok.com)
async function testTikTokLibrary() {
  console.log("\n═ 3) library.tiktok.com")
  try {
    const res = await fetch("https://library.tiktok.com/ads?region=EG&query=%D9%83%D8%A7%D8%B4%D9%8A%D8%B1", {
      headers: { "User-Agent": UA, accept: "text/html" },
      signal: AbortSignal.timeout(15000),
    })
    const text = await res.text()
    console.log(`   [HTTP ${res.status}] len=${text.length} (JS app لو قصيرة)`)
  } catch (e) { console.log(`   ❌ ${e instanceof Error ? e.message : e}`) }
}

await testGoogleTransparency()
await testMetaAdsLibrary()
await testTikTokLibrary()
