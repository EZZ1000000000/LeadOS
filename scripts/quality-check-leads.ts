/** فحص جودة Leads بعد دورة المحرك الجديد + تنظيف العناوين المشوشة */
import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()

async function main() {
  const total = await db.lead.count()
  const byType = await db.lead.groupBy({ by: ["leadSourceType"], _count: true })
  console.log("إجمالي في القاعدة:", total)
  for (const b of byType) console.log(`  ${b.leadSourceType}: ${b._count}`)

  const leads = await db.lead.findMany({ select: { id: true, businessId: true, business: { select: { id: true, name: true } } } })
  const isNoisy = (n: string) =>
    n.startsWith("#") || n.length < 5 || n.split(/\s+/).every((w) => w.startsWith("#")) ||
    /^[0-9%.\s…،؟!-]+$/.test(n) || n.toLowerCase().startsWith("0%")
  const noisy = leads.filter((l) => {
    const n = l.business?.name ?? ""
    return !n || isNoisy(n)
  })
  console.log("عناوين مشوشة/غير أعمال:", noisy.length)

  let removed = 0
  for (const l of noisy.slice(0, 200)) {
    await db.leadContent.deleteMany({ where: { leadId: l.id } })
    await db.leadSource.deleteMany({ where: { leadId: l.id } })
    await db.lead.deleteMany({ where: { id: l.id } })
    if (l.businessId) {
      await db.businessSource.deleteMany({ where: { businessId: l.businessId } }).catch(() => undefined)
      await db.business.deleteMany({ where: { id: l.businessId } }).catch(() => undefined)
    }
    removed++
  }
  console.log(`تم حذف: ${removed} — المتبقي: ${await db.lead.count()}`)
}

main().finally(() => db.$disconnect())
