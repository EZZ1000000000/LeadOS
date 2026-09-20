// استعادة سكور الليدز: إعادة احتساب بمنطق النظام (recomputeLeadScore)
// الضوضاء المؤكدة بس هي اللي تفضل مخفوضة
import { db } from "../src/lib/db"
import { recomputeLeadScore } from "../src/lib/scoring"

const JUNK = [
  /cambridge|dictionary|wikipedia|wiktionary|reverso|قاموس|المعنى|معنى\s*كلمة/i,
  /^(what is|what's)\s+(this|the|a|an)\b/i,
  /^(مبرمجين مصر|Jusstkamal|Hana Schaker|Khairy \d+|Moustafa Elmazayen)$/i,
]

async function main() {
  const leads = await db.lead.findMany({
    include: { business: { select: { name: true } } },
  })
  let junk = 0
  let recomputed = 0
  for (const l of leads) {
    const name = l.business?.name ?? ""
    if (JUNK.some((re) => re.test(name))) {
      await db.lead.update({ where: { id: l.id }, data: { score: 20 } })
      junk++
      console.log(`  🗑 ضوضاء (مخفوضة لـ 20): ${name.slice(0, 60)}`)
      continue
    }
    await recomputeLeadScore(l.id)
    recomputed++
  }
  const stats = await db.lead.groupBy({ by: ["status"], _count: true })
  const hot = await db.lead.count({ where: { score: { gte: 60 } } })
  const warm = await db.lead.count({ where: { score: { gte: 45, lt: 60 } } })
  console.log(`\nإعادة احتساب: ${recomputed} | ضوضاء: ${junk}`)
  console.log(`الساخنة (≥60): ${hot} | الدافئة (45-59): ${warm} | الإجمالي: ${leads.length}`)
  console.log(JSON.stringify(stats))
  process.exit(0)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
