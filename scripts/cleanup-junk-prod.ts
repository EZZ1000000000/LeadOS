// تنظيف الليدز الوهمية (عقارات/غرف/بروفايلات شخصية) من الإنتاج + حذف البيزنس اليتيم
import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()

const NOISE_RE = [
  /^(شقه|شقة|غرفه|غرفة|استوديو|فيله|فيلا|أرض|ارض)\s/u,
  /^(محتاج|محتاجة|عايز|عاوز|مطلوب)\s+(شقه|شقة|غرفه|غرفة|استوديو)/u,
  /(للإيجار|للايجار|إيجار يومي|ايجار يومي|شقه مفروشه|شقة مفروشه|غرفه مفروشه|غرفة مفروشه)/u,
  /\s[-–—]\s*(Facebook|LinkedIn|Instagram|YouTube|Twitter|X)\s*$/iu,
  /^‏/u, // RLM prefix
  /ملف شخصي احترافي/u,
]

async function main() {
  const wsAll = await db.workspace.findMany({ select: { id: true, name: true } })
  let totalDeleted = 0
  for (const w of wsAll) {
    const leads = await db.lead.findMany({ where: { workspaceId: w.id }, select: { id: true, businessId: true, business: { select: { name: true } } } })
    const junk = leads.filter((l) => l.business && NOISE_RE.some((re) => re.test(l.business!.name)))
    if (!junk.length) { console.log(`[${w.name}] نظيف ✓`); continue }
    console.log(`[${w.name}] هتشيل ${junk.length}:`)
    for (const j of junk) console.log(`  ✗ ${j.business!.name.slice(0, 70)}`)
    const bizIds = [...new Set(junk.map((j) => j.businessId).filter((x): x is string => Boolean(x)))]
    await db.lead.deleteMany({ where: { id: { in: junk.map((j) => j.id) } } })
    // بيزنس يتيم؟ (مفيش ليدز مرتبطة بيه بعد الحذف)
    for (const bid of bizIds) {
      const remaining = await db.lead.count({ where: { businessId: bid } })
      if (remaining === 0) await db.business.deleteMany({ where: { id: bid } })
    }
    totalDeleted += junk.length
  }
  console.log(`TOTAL DELETED: ${totalDeleted}`)
  await db.$disconnect()
}
main().catch((e) => { console.error("ERR:", e.message); process.exit(1) })
