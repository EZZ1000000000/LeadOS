// Task 19 — تنظيف ليدز الجروبات الأجنبية/الضجيج (اللي اتحفظت قبل الفلتر المشدد)
import { PrismaClient } from "@prisma/client"
const url = (await import("fs")).readFileSync("/tmp/neon_url", "utf8").trim()
const db = new PrismaClient({ datasources: { db: { url } } })

const FOREIGN = /السعودية|الرياض|جدة|الإمارات|دبي|الكويت|قطر|اليمن|صنعاء|المغرب|تونس|الجزائر|السودان|Minnesota|Ramada/i

try {
  // محتوى جروبات من غير /posts/ في الرابط (صفحات جروب) أو أجنبي
  const items = await db.contentItem.findMany({
    where: { rawData: { path: ["platform"], equals: "FACEBOOK_GROUPS" } },
    select: { id: true, canonicalUrl: true, title: true },
    take: 100,
  })
  const junkItems = items.filter((i) => {
    const isPost = /\/groups\/[^/]+\/posts\//.test(i.canonicalUrl ?? "")
    const foreign = FOREIGN.test(i.title ?? "")
    return !isPost || foreign
  })
  console.log(`محتوى جروبات: ${items.length} | ضجيج هيتشال: ${junkItems.length}`)
  for (const j of junkItems) console.log(" 🗑️", (j.title ?? "").slice(0, 55), "|", (j.canonicalUrl ?? "").slice(0, 60))

  // الليدز المرتبطة بالضجيج ده
  let deletedLeads = 0
  for (const j of junkItems) {
    const links = await db.leadContent.findMany({ where: { contentId: j.id }, select: { leadId: true } })
    for (const l of links) {
      // امسح الليد بس لو مش مرتبط بمحتوى نضيف تاني
      const goodLinks = await db.leadContent.count({ where: { leadId: l.leadId, contentId: { notIn: junkItems.map((x) => x.id) } } })
      if (goodLinks === 0) {
        const lead = await db.lead.findUnique({ where: { id: l.leadId }, select: { businessId: true } })
        await db.leadContent.deleteMany({ where: { leadId: l.leadId } })
        await db.lead.deleteMany({ where: { id: l.leadId } })
        if (lead?.businessId) await db.business.deleteMany({ where: { id: lead.businessId } })
        deletedLeads++
      }
    }
    await db.contentItem.delete({ where: { id: j.id } }).catch(() => undefined)
  }
  console.log(`\n✅ اتشال ${deletedLeads} ليد ضجيج + ${junkItems.length} محتوى`)
} finally { await db.$disconnect() }
