// LeadOS — Seed sources + search rules after a DB wipe (idempotent)
// Run: bun run scripts/seed-sources-rules.ts
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

const RULES: Array<{
  name: string
  description: string
  priority: number
  sourceTypes: string[]
  keywords: string[]
  cities: string[]
  industries: string[]
  services: string[]
}> = [
  {
    name: "إشارات مصر الحارة — طلبات صريحة على فيسبوك",
    description: "ناس بتحتاج مبرمج/نظام دلوقتي — أعلى أولوية",
    priority: 200,
    sourceTypes: ["FACEBOOK", "GOOGLE_SEARCH"],
    keywords: [
      'site:facebook.com/posts "محتاج مبرمج"',
      'site:facebook.com/posts "عايز حد يعمل لي موقع"',
      'site:facebook.com "محتاج نظام كاشير"',
      '"محتاج مبرمج" مصر',
      '"مطلوب شركة برمجة" مصر',
      '"عايز تطبيق لمشروعي"',
    ],
    cities: [],
    industries: [],
    services: [],
  },
  {
    name: "ريدت — أصحاب بيزنس بيدوروا مبرمجين",
    description: "demand عالمي بالإنجليزي من r/smallbusiness و r/ecommerce",
    priority: 160,
    sourceTypes: ["REDDIT"],
    keywords: [
      "looking for software development agency recommendation",
      "need a developer for my small business",
      "recommend an agency to build my online store",
      "need POS system for my cafe",
      "hire web development agency for restaurant booking",
    ],
    cities: [],
    industries: [],
    services: [],
  },
  {
    name: "ويب مصري — إشارات نمو وتوسع",
    description: "شركات بتتوسع / بتفتح فروع / بتوظف تقنية — وقت الشراء",
    priority: 140,
    sourceTypes: ["GOOGLE_SEARCH", "NEWS"],
    keywords: [
      "شركة مصرية تفتح فروع جديدة",
      "سلسلة مطاعم مصرية تتوسع",
      "افتتاح مجموعة عيادات جديدة مصر",
      "براند مصري يطلق متجره الإلكتروني",
      "شركة مصرية توظف مدير تقنية معلومات",
      "مجموعة محلات مصر تخطط للتوسع",
    ],
    cities: [],
    industries: [],
    services: [],
  },
  {
    name: "قطاعات الـ 36 مجال — كاشير وحجز ومتاجر",
    description: "قوالب المدن×الصناعات×الخدمات من المعرفة",
    priority: 120,
    sourceTypes: ["GOOGLE_SEARCH"],
    keywords: [],
    cities: ["القاهرة", "الجيزة", "الاسكندرية"],
    industries: ["مطاعم", "عيادات", "كافيهات", "متاجر"],
    services: ["نظام كاشير", "موقع إلكتروني", "نظام حجز"],
  },
  {
    name: "الخليج — طلبات وكالات",
    description: "سعودية/إمارات — مشاريع بتدور تنفيذ",
    priority: 90,
    sourceTypes: ["GOOGLE_SEARCH"],
    keywords: [
      "مطلوب شركة برمجة في الرياض",
      "نحتاج وكالة تسويق لمشروع في دبي",
      "مطلوب نظام ERP شركة سعودية",
      "نبحث عن شركة تصميم مواقع جدة",
    ],
    cities: [],
    industries: [],
    services: [],
  },
]

async function main() {
  const ws = await db.workspace.findFirst({ orderBy: { createdAt: "asc" } })
  if (!ws) {
    console.log("❌ مفيش workspace — سجل حساب الأول")
    process.exit(1)
  }
  console.log(`📁 Workspace: ${ws.name} (${ws.id})`)

  const existingRules = await db.searchRule.count({ where: { workspaceId: ws.id } })
  const existingSources = await db.source.count({ where: { workspaceId: ws.id } })
  if (existingRules > 0 && existingSources > 0) {
    console.log(`⏭ موجود بالفعل (${existingSources} مصادر، ${existingRules} قواعد) — مفيش حاجة محتاجة seeding`)
    process.exit(0)
  }

  if (existingSources === 0) {
    const src = await db.source.create({
      data: {
        workspaceId: ws.id,
        type: "GOOGLE_SEARCH",
        name: "البحث الحي — الويب",
        status: "ACTIVE",
        config: { providers: ["serper", "tavily", "serpapi", "exa", "searxng", "zai"] },
        scheduleCron: "*/15 * * * *",
      },
    })
    console.log(`✅ مصدر: ${src.name} (${src.id})`)
  }

  if (existingRules === 0) {
    for (const r of RULES) {
      const rule = await db.searchRule.create({
        data: {
          workspaceId: ws.id,
          name: r.name,
          description: r.description,
          enabled: true,
          priority: r.priority,
          countries: ["Egypt"],
          cities: r.cities,
          industries: r.industries,
          services: r.services,
          keywords: r.keywords,
          sourceTypes: r.sourceTypes,
          minLeadScore: 0,
          scheduleCron: "*/20 * * * *",
          startResearch: true,
          researchDepth: "DEEP",
        },
      })
      console.log(`✅ قاعدة: ${rule.name} (أولوية ${rule.priority})`)
    }
  }
  console.log("🎉 خلص السيد")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
