// اختبار السلسلة الكاملة rawWebSearch محليًا
import { rawWebSearch } from "../src/lib/discovery"

async function main() {
  for (const q of [
    "(site:mostaql.com OR site:khamsat.com) محتاج مصمم جرافيك",
    "(site:linkedin.com OR site:www.linkedin.com) عيادة أسنان القاهرة",
  ]) {
    const t0 = Date.now()
    const { results, provider } = await rawWebSearch(q, 10, 30)
    console.log(`[${q.slice(0, 45)}] → provider=${provider} | ${results.length} نتيجة | ${Date.now() - t0}ms`)
    for (const r of results.slice(0, 3)) console.log(`   • ${r.name.slice(0, 50)} → ${r.host_name}`)
  }
}
main()
