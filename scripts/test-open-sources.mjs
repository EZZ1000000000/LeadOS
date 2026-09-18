// test-open-sources.mjs — اختبار المصادر المفتوحة (ريديت + X) بدون جلسات
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0"

// ─── 1) Reddit: r/egypt — أحدث 40 ───
console.log("═".repeat(50))
console.log("[1] Reddit — r/egypt جديد:")
try {
  const res = await fetch("https://www.reddit.com/r/egypt/new.json?limit=40", {
    headers: { "User-Agent": "LeadOS-GroupMonitor/1.0 (lead intelligence)" },
    signal: AbortSignal.timeout(15000),
  })
  console.log("  HTTP:", res.status)
  if (res.ok) {
    const data = await res.json()
    const children = data?.data?.children ?? []
    console.log("  منشورات مستلمة:", children.length)
    // فلترة إشارات نية الشراء
    const intentRe = /(محتاج|أبحث عن|بديل|سعر|تكلفة|أفضل شركة|نظام|برنامج|خدمة|اقتراح)/i
    const hits = children
      .map((c) => c.data)
      .filter((d) => intentRe.test(`${d.title} ${d.selftext || ""}`))
      .slice(0, 5)
    for (const d of hits) {
      console.log(`  ✓ [${d.score}↑] ${d.title?.slice(0, 70)}`)
      console.log(`     https://www.reddit.com${d.permalink}`)
    }
    if (!hits.length) console.log("  (لا إشارات نية في آخر 40 — المصدر نفسه شغال)")
  }
} catch (e) {
  console.log("  ERROR:", e.message?.slice(0, 100))
}

// ─── 2) Reddit: r/EgyptBusiness ───
console.log("═".repeat(50))
console.log("[2] Reddit — r/EgyptBusiness:")
try {
  const res = await fetch("https://www.reddit.com/r/EgyptBusiness/new.json?limit=25", {
    headers: { "User-Agent": "LeadOS-GroupMonitor/1.0 (lead intelligence)" },
    signal: AbortSignal.timeout(15000),
  })
  console.log("  HTTP:", res.status)
  if (res.ok) {
    const data = await res.json()
    const children = data?.data?.children ?? []
    console.log("  منشورات مستلمة:", children.length)
    for (const c of children.slice(0, 3)) {
      const d = c.data
      console.log(`  ✓ ${d.title?.slice(0, 70)}`)
    }
  }
} catch (e) {
  console.log("  ERROR:", e.message?.slice(0, 100))
}

// ─── 3) X (تويتر) بحث حي عبر الستيلث ───
console.log("═".repeat(50))
console.log("[3] X (تويتر) — بحث حي 'محتاج نظام كاشير':")
try {
  const nav = await fetch("http://localhost:9797/navigate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session: "x",
      url: "https://x.com/search?q=" + encodeURIComponent("محتاج نظام كاشير") + "&f=live",
      wait_until: "domcontentloaded",
      timeout: 50000,
    }),
    signal: AbortSignal.timeout(90000),
  })
  const j = await nav.json().catch(() => ({}))
  console.log("  ok:", j.ok, "| url:", (j.url || "").slice(0, 70))
  const t = j.text || ""
  console.log("  نص الصفحة (أول 250):")
  console.log("  " + t.slice(0, 250).replace(/\n/g, "\n  "))
} catch (e) {
  console.log("  ERROR:", e.message?.slice(0, 100))
}
console.log("═".repeat(50))
console.log("تم — المصادر المفتوحة اتحجمت")
