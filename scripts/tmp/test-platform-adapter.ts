// اختبار: هل platformAdapter بيرجع نتايج من المنصات المدفوعة (olx/wuzzuf/quora)؟
import { PLATFORM_SITES, matchesSite, rawWebSearch } from "@/lib/discovery"

async function platformAdapter(platform: string, query: string, limit: number, recencyDays: number) {
  // نسخة مصغرة من نفس المنطق — نفس سلسلة المحاولات الثلاثية
  
  const toItem = (r: { url: string; title: string }) => ({ title: r.title, url: r.url })
  const sites = PLATFORM_SITES[platform]
  const pinned = query.includes("مصر") ? query : `${query} مصر`
  const onPlatform = (r: { url: string }) => sites.some((s) => matchesSite(r.url, s))
  const siteQuery = sites.map((s) => `site:${s}`).join(" OR ")
  const first = await rawWebSearch(`(${siteQuery}) ${pinned}`, limit, recencyDays)
  let rs = first.results.filter(onPlatform)
  if (!rs.length) {
    const slim = pinned.split(/\s+/).slice(0, 5).join(" ")
    const second = await rawWebSearch(`site:${sites[0]} ${slim}`, limit, recencyDays)
    rs = second.results.filter(onPlatform)
    if (!rs.length) {
      const third = await rawWebSearch(slim, limit * 2, recencyDays)
      rs = third.results.filter(onPlatform)
    }
  }
  return rs.map(toItem)
}

const tests: Array<[string, string]> = [
  ["MARKETPLACE", "كافيه للبيع"],
  ["JOBS", "مطلوب مدير مبيعات"],
  ["QUORA", "افضل شركة برمجة في مصر"],
  ["DIRECTORY", "شركات برمجة القاهرة دليل شركات"],
]
for (const [p, q] of tests) {
  const t0 = Date.now()
  const items = await platformAdapter(p, q, 5, 14)
  console.log(`${p.padEnd(12)} ${items.length} عنصر في ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  for (const it of items.slice(0, 2)) console.log("   →", it.title.slice(0, 60), "|", it.url.slice(0, 70))
}
