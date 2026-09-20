// كنسحة جودة للورشة الحالية: خفض سكور الضوضاء اللي دخلت قبل تحديث الفلاتر
// + تطبيق قاعدة التواصل (ساخن لازم له تليفون/إيميل/موقع)
import { db } from "../src/lib/db"

const NOISE_TITLE = [
  /^(top|best|\d+\s+(best|top))\s+/i,
  /reviews?\s*[-–]?\s*\d{4}/i,
  /companies?\s+in\s+egypt/i,
  /(guide|list|directory)\s+of\s+/i,
  /\b(erp|crm|software)\s+(companies|providers|vendors)\b/i,
  /cambridge|dictionary|wikipedia|wiktionary|reverso|قاموس|المعنى|معنى\s*كلمة/i,
  /^(what is|what's)\s+(this|the|a|an)\b/i,
  /^تبرع|donat|وظائف في |وظائف خالية/i,
]

async function main() {
  const workspaces = await db.workspace.findMany({ select: { id: true } })
  let demoted = 0
  for (const ws of workspaces) {
    const leads = await db.lead.findMany({
      where: { workspaceId: ws.id, score: { gte: 40 } },
      include: { business: { select: { name: true, websiteUrl: true, phone: true, email: true, mapsUrl: true } } },
    })
    for (const l of leads) {
      const name = l.business?.name ?? ""
      let hit = NOISE_TITLE.some((re) => re.test(name))
      // أسماء عامة مفيهاش تواصل + مفيش نية = ضوضاء
      if (!hit && !l.business?.phone && !l.business?.email && !l.business?.websiteUrl && !l.business?.mapsUrl && (l.intentScore ?? 0) < 60 && (l.score ?? 0) < 55) hit = true
      if (hit) {
        await db.lead.update({ where: { id: l.id }, data: { score: Math.min(l.score ?? 0, 25) } })
        demoted++
        console.log(`  ↓ خفض: ${name.slice(0, 70)}`)
        continue
      }
      // قاعدة التواصل: ساخن (≥60) لازم له قناة تواصل
      const b = l.business
      const reachable = Boolean(b?.phone || b?.email || b?.websiteUrl || b?.mapsUrl)
      if ((l.score ?? 0) >= 60 && !reachable) {
        await db.lead.update({ where: { id: l.id }, data: { score: 45 } })
        demoted++
        console.log(`  ↓ غير قابل للتواصل: ${name.slice(0, 70)}`)
      }
    }
  }
  const hot = await db.lead.count({ where: { score: { gte: 60 } } })
  const total = await db.lead.count()
  console.log(`خُفض ${demoted} | الإجمالي: ${total} | الساخنة دلوقتي: ${hot}`)
  process.exit(0)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
