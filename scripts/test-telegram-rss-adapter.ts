// اختبار حي سريع لمحولي تليجرام وRSS الجداد
import { runDiscovery } from "../src/lib/discovery"

const t0 = Date.now()
const tg = await runDiscovery(["TELEGRAM"], ["بيزنس ومشاريع مصرية محتاجة أنظمة"], 6)
console.log(`TELEGRAM: ${tg.items.length} items | adapters: ${tg.adaptersUsed.join(",")} | ${((Date.now() - t0) / 1000).toFixed(1)}s`)
for (const i of tg.items.slice(0, 3)) console.log(`  • [${i.contentType}] ${i.title.slice(0, 70)} → ${i.url.slice(0, 60)}`)

const t1 = Date.now()
const rss = await runDiscovery(["RSS"], ["شركات مصرية توسع استثمار"], 6)
console.log(`RSS: ${rss.items.length} items | adapters: ${rss.adaptersUsed.join(",")} | ${((Date.now() - t1) / 1000).toFixed(1)}s`)
for (const i of rss.items.slice(0, 3)) console.log(`  • [${i.contentType}] ${i.title.slice(0, 70)} → ${i.url.slice(0, 60)}`)
