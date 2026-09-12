// كنسحة جودة نهائية: تخفيض سكور الضوضاء غير-الليدز (مقالات Top/Best/Reviews + صفحات تجميع)
// بحيث السheet الساخنة تبقى ليدز فعلية بس
import { db } from "../src/lib/db"

const WS_ID = "cmtyimk8f0002oonlxid1k38p"
// أنماط ضوضاء: مقالات تجميعية/قوائم/مقارنات — مش بيزنس ناوي يشتري
const NOISE_TITLE = [
  /^(top|best|\d+\s+(best|top))\s+/i,
  /reviews?\s*[-–]?\s*\d{4}/i,
  /companies?\s+in\s+egypt/i,
  /(guide|list|directory)\s+of\s+/i,
  /\b(erp|crm|software)\s+(companies|providers|vendors)\b/i,
]

async function main() {
  const leads = await db.lead.findMany({
    where: { workspaceId: WS_ID, score: { gte: 45 } },
    include: { business: { select: { name: true, websiteUrl: true, phone: true, email: true, mapsUrl: true } } },
  })
  let demoted = 0
  for (const l of leads) {
    const name = l.business?.name ?? ""
    if (NOISE_TITLE.some((re) => re.test(name))) {
      await db.lead.update({ where: { id: l.id }, data: { score: Math.min(l.score, 25) } })
      demoted++
      console.log(`  ↓ خفض: ${name.slice(0, 70)}`)
      continue
    }
    // قاعدة قابلة للتواصل: ساخن (≥60) لازم له تليفون أو إيميل أو موقع — البوستات/الأخبار ملهاها تواصل
    const b = l.business
    const reachable = Boolean(b?.phone || b?.email || b?.websiteUrl || b?.mapsUrl)
    if (l.score >= 60 && !reachable) {
      await db.lead.update({ where: { id: l.id }, data: { score: 45 } })
      demoted++
      console.log(`  ↓ غير قابل للتواصل: ${name.slice(0, 70)}`)
    }
  }
  const hot = await db.lead.count({ where: { workspaceId: WS_ID, score: { gte: 60 } } })
  console.log(`خُفض ${demoted} | الساخنة دلوقتي: ${hot}`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
