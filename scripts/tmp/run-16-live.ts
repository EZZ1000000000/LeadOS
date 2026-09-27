// تشغيل حي كامل: قاعدة «موجة الـ17 منصة» على الداتابيز المحلية + نبضة حقيقية
// الهدف: إثبات إن كل المنصات المبنية بتتصطاد وتنزّل ليدز حقيقية في الداتابيز
import { db } from "../../src/lib/db"
import { processTick } from "../../src/lib/queue"

const ALL_PLATFORMS = [
  "FACEBOOK", "INSTAGRAM", "X", "LINKEDIN", "REDDIT", "TIKTOK", "YOUTUBE",
  "DIRECTORY", "JOBS", "MARKETPLACE", "TELEGRAM", "FREELANCE",
  "ADS_LIBRARY", "REVIEWS", "EVENTS", "QUORA", "DISCORD",
]

// 1) وورك سبيس محلي جاهز
let ws = await db.workspace.findFirst({ where: { isActive: true } })
if (!ws) {
  ws = await db.workspace.create({ data: { name: "زيزو — التشغيل الحي", slug: "zizo-live-16" } })
  console.log(`✦ اتأنشأ وورك سبيس: ${ws.name}`)
}

// 2) المصدر النشط (لازم يبقى فيه واحد عشان الـingest يسجّل)
let source = await db.source.findFirst({ where: { workspaceId: ws.id, status: "ACTIVE" } })
if (!source) {
  source = await db.source.create({
    data: { workspaceId: ws.id, type: "GOOGLE_SEARCH", name: "موجة المنصات الكاملة" },
  })
  console.log(`✦ اتأنشأ مصدر: ${source.name}`)
}

// 3) القاعدة: كل المنصات مفعّلة + كلمات نية شراء مصرية
const rule = await db.searchRule.upsert({
  where: { id: (await db.searchRule.findFirst({ where: { workspaceId: ws.id, name: "موجة الـ17 منصة" } }))?.id ?? "none" },
  update: { sourceTypes: ALL_PLATFORMS, enabled: true },
  create: {
    workspaceId: ws.id,
    name: "موجة الـ17 منصة",
    description: "كل منصات الاكتشاف المبنية — تشغيل حي كامل",
    enabled: true,
    priority: 10,
    keywords: ["محتاج مبرمج", "محتاج موقع", "عايز تطبيق", "محتاج مصمم", "حد يعرف مبرمج شاطر"],
    cities: ["القاهرة", "الجيزة", "الاسكندرية"],
    services: ["برمجة", "موقع الكتروني", "تطبيق موبايل"],
    sourceTypes: ALL_PLATFORMS,
    minLeadScore: 0,
    startResearch: false,
    researchDepth: "QUICK",
  },
})
console.log(`✦ القاعدة جاهزة: «${rule.name}» — ${ALL_PLATFORMS.length} منصة مفعّلة`)

// 4) عدّاد قبل
const leadsBefore = await db.lead.count({ where: { workspaceId: ws.id } })
console.log(`✦ الليدز قبل النبضة: ${leadsBefore}`)

// 5) النبضة الحية
console.log("\n⏱ بدأت النبضة الحية (أقصى 3 جوبات — كل جوبة لحد 10 عمليات بحث)...")
const t0 = Date.now()
const result = await processTick(3)
console.log(`✅ النبضة خلصت في ${((Date.now() - t0) / 1000).toFixed(0)}s — مهام: ${result.processed}، قواعد مجدولة: ${result.scheduledRules}`)
for (const d of result.details.slice(0, 10)) console.log(`  • ${d.slice(0, 160)}`)

// 6) الليدز الجديدة
const leadsAfter = await db.lead.count({ where: { workspaceId: ws.id } })
console.log(`\n════════ النتيجة ════════`)
console.log(`ليدز جديد: ${leadsAfter - leadsBefore} (الإجمالي ${leadsAfter})`)

const recent = await db.lead.findMany({
  where: { workspaceId: ws.id },
  orderBy: { createdAt: "desc" },
  take: 12,
  select: { score: true, leadSourceType: true, createdAt: true, person: { select: { fullName: true } }, business: { select: { name: true } } },
})
for (const l of recent) {
  const who = l.person?.fullName || l.business?.name || "—"
  console.log(`  🎯 ${who.slice(0, 45)} | ${l.leadSourceType} | score=${l.score} | ${l.createdAt.toISOString().slice(11, 16)}`)
}
process.exit(0)
