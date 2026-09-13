/**
 * تنظيف بيانات اختبار الـWorker (source = "Botasaurus Worker") — يُستخدم بعد اختبارات التكامل.
 * يحذف: Leads + Businesses + ContentItems + LeadSources المرتبطة بمصدر الـWorker التجريبي.
 */
import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()

async function main() {
  const src = await db.source.findFirst({ where: { name: { contains: "Botasaurus Worker" } } })
  if (!src) {
    console.log("لا يوجد مصدر Botasaurus Worker — لا شيء للتنظيف")
    return
  }

  const contents = await db.contentItem.findMany({
    where: { sourceId: src.id },
    select: { id: true },
  })
  const contentIds = contents.map((c) => c.id)
  console.log(`عناصر محتوى المصدر التجريبي: ${contentIds.length}`)

  // الـLeads المرتبطة بعناصر المحتوى دي
  const leadLinks = await db.leadContent.findMany({
    where: { contentId: { in: contentIds } },
    select: { leadId: true },
  })
  const leadIds = [...new Set(leadLinks.map((l) => l.leadId))]
  console.log(`Leads تجريبية: ${leadIds.length}`)

  // حذف بالترتيب (التابعات الأول)
  for (const leadId of leadIds) {
    await db.leadContent.deleteMany({ where: { leadId } })
    await db.leadSource.deleteMany({ where: { leadId } })
    await db.leadTag.deleteMany({ where: { leadId } }).catch(() => undefined)
    await db.note.deleteMany({ where: { leadId } }).catch(() => undefined)
    await db.task.deleteMany({ where: { leadId } }).catch(() => undefined)
    await db.activity.deleteMany({ where: { leadId } }).catch(() => undefined)
    await db.finding.deleteMany({ where: { leadId } }).catch(() => undefined)
    await db.opportunity.deleteMany({ where: { leadId } }).catch(() => undefined)
    await db.researchRun.deleteMany({ where: { leadId } }).catch(() => undefined)
    await db.alert.deleteMany({ where: { leadId } }).catch(() => undefined)
    await db.lead.deleteMany({ where: { id: leadId } })
  }

  // الشركات المرتبطة (اللي مش ليها leads تانية)
  const businesses = await db.business.findMany({
    where: { name: { contains: "TEST-" } },
    select: { id: true },
  })
  for (const b of businesses) {
    await db.businessSource.deleteMany({ where: { businessId: b.id } }).catch(() => undefined)
    await db.lead.deleteMany({ where: { businessId: b.id } })
    await db.business.delete({ where: { id: b.id } }).catch(() => undefined)
  }
  // عيادة إيليت وكافيه ريبابلك (بيانات اختبار يدوية)
  for (const name of ["عيادة إيليت لطب الأسنان — مصر الجديدة", "كافيه ريبابلك المعادي"]) {
    const b = await db.business.findFirst({ where: { name } })
    if (b) {
      await db.businessSource.deleteMany({ where: { businessId: b.id } }).catch(() => undefined)
      await db.lead.deleteMany({ where: { businessId: b.id } })
      await db.business.delete({ where: { id: b.id } }).catch(() => undefined)
    }
  }

  await db.contentItem.deleteMany({ where: { sourceId: src.id } })
  await db.searchJob.deleteMany({ where: { sourceId: src.id } }).catch(() => undefined)
  await db.source.delete({ where: { id: src.id } })

  const remaining = await db.lead.count()
  console.log(`✅ التنظيف خلص — Leads المتبقية الحقيقية: ${remaining}`)
}

main().finally(() => db.$disconnect())
