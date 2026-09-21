// LeadOS — صيد من الأدابترات المجانية (تليجرام/RSS/ريديت) عبر المسار الرسمي
// بيستخدم SearchRules + buildSearchPlan + ingestDiscoveredItems — نفس منطق التكة بالظبط
import { runDiscovery, buildSearchPlan } from "../src/lib/discovery"
import { ingestDiscoveredItems } from "../src/lib/queue"
import { db } from "../src/lib/db"

const FREE_TYPES = ["TELEGRAM", "RSS", "REDDIT"]

async function main() {
  const ws = await db.workspace.findFirst()
  if (!ws) throw new Error("مفيش ورشة")

  const rules = await db.searchRule.findMany({ where: { enabled: true } })
  console.log(`قواعد بحث: ${rules.length}`)

  let totalCreated = 0
  for (const rule of rules) {
    const sourceTypes = Array.isArray(rule.sourceTypes) ? (rule.sourceTypes as string[]) : []
    const freeTypes = sourceTypes.filter((t) => FREE_TYPES.includes(t))
    if (!freeTypes.length) continue

    const plan = buildSearchPlan(rule)
    if (!plan.queries.length) continue

    console.log(`\n▶ قاعدة: ${rule.name.slice(0, 50)} | أنواع مجانية: ${freeTypes.join(",")} | استعلامات: ${plan.queries.length}`)
    try {
      const { items, adaptersUsed } = await runDiscovery(freeTypes, plan.queries.slice(0, 3), 6)
      console.log(`  اتصاد: ${items.length} عنصر [${adaptersUsed.join(",") || "none"}]`)
      if (!items.length) continue

      // مصدر الالتصاق: أول مصدر مجاني نشط (زي ما processDiscoveryJob بيعمل)
      const source = await db.source.findFirst({
        where: { workspaceId: ws.id, status: "ACTIVE", type: { in: freeTypes } },
      })
      if (!source) continue
      const { created, duplicates } = await ingestDiscoveredItems(
        ws.id,
        { id: source.id, type: source.type, name: source.name },
        { id: rule.id, startResearch: rule.startResearch, researchDepth: rule.researchDepth },
        items,
      )
      totalCreated += created
      console.log(`  ✅ ليدز جديدة: ${created} (مكرر: ${duplicates})`)
    } catch (e) {
      console.log(`  ❌ ${String(e).slice(0, 90)}`)
    }
  }
  console.log(`\n🎯 الإجمالي: ${totalCreated} ليد جديد`)
  await db.$disconnect()
}

main()
