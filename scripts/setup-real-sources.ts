// LeadOS — Configure REAL multi-platform sources + rules.
// Activates all social/web platforms (public-web discovery via site: operators),
// pauses Google Maps (needs GOOGLE_MAPS_API_KEY), and wires rules across platforms.
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  const ws = await db.workspace.findFirst()
  if (!ws) throw new Error("workspace missing — run seed first")
  const wsId = ws.id
  console.log(`Workspace: ${ws.name}`)

  const upsert = async (type: string, name: string, status: "ACTIVE" | "PAUSED", config: object, scheduleCron: string, lastError: string | null = null) => {
    const existing = await db.source.findFirst({ where: { workspaceId: wsId, type } })
    if (existing) {
      await db.source.update({ where: { id: existing.id }, data: { name, status, config: config as object, scheduleCron, lastError } })
      console.log(`  updated ${type} → ${status}`)
      return existing.id
    }
    const created = await db.source.create({ data: { workspaceId: wsId, type: type as never, name, status, config: config as object, scheduleCron, lastError } })
    console.log(`  created ${type} → ${status}`)
    return created.id
  }

  console.log("Sources:")
  // Social + web platforms — all real via public-web site: searches
  await upsert("FACEBOOK", "فيسبوك — جروبات وصفحات أصحاب الأعمال", "ACTIVE", { scope: "groups+pages", market: "Egypt" }, "0 */2 * * *")
  await upsert("LINKEDIN", "لينكدإن — منشورات ووظائف صنّاع القرار", "ACTIVE", { scope: "posts+jobs", market: "Egypt" }, "30 */2 * * *")
  await upsert("INSTAGRAM", "إنستجرام — براندات ومتاجر", "ACTIVE", { scope: "brands", market: "Egypt" }, "15 */3 * * *")
  await upsert("X", "X (تويتر) — طلبات وترشيحات لحظية", "ACTIVE", { scope: "requests", market: "Egypt" }, "45 */3 * * *")
  await upsert("REDDIT", "Reddit — r/egypt r/EgyptBusiness نوايا الشراء", "ACTIVE", { subreddits: ["egypt", "EgyptBusiness", "startups"] }, "*/30 * * * *")
  await upsert("TIKTOK", "تيك توك — براندات صاعدة", "ACTIVE", { scope: "brands", market: "Egypt" }, "20 */4 * * *")
  await upsert("YOUTUBE", "يوتيوب — أعمال ومراجعات", "ACTIVE", { scope: "reviews+business" }, "40 */4 * * *")
  await upsert("NEWS", "أخبار الأعمال — افتتاحات وتوسعات واستثمارات", "ACTIVE", { market: "Egypt" }, "10 * * * *")
  await upsert("DIRECTORY", "أدلة الأعمال المصرية — بيانات تواصل", "ACTIVE", { market: "Egypt" }, "0 */6 * * *")
  await upsert("WEBSITE", "منصات التوظيف — إشارات توسّع وتوظيف (Wuzzuf/Forasna)", "ACTIVE", { signals: ["hiring", "expansion"] }, "50 */6 * * *")
  // Google Places: honest state — needs a key, otherwise produces nothing (no fakes)
  await upsert("GOOGLE_MAPS", "خرائط جوجل — يحتاج GOOGLE_MAPS_API_KEY", "PAUSED", { cities: ["Cairo", "Giza", "Alexandria"] }, "0 */1 * * *",
    "متوقف: أضف GOOGLE_MAPS_API_KEY لتشغيل اكتشاف الخرائط الحقيقي")
  await upsert("GOOGLE_SEARCH", "بحث الويب المفتوح — إشارات نوايا عامة", "ACTIVE", { freshness: "14d" }, "*/20 * * * *")

  // ---- Rules: distribute intent searches across platforms ----
  console.log("Rules:")
  const setRule = async (findName: string, data: { name: string; description: string; priority: number; cities: string[]; industries: string[]; services: string[]; keywords: string[]; excludedWords: string[]; sourceTypes: string[]; minLeadScore: number; startResearch?: boolean; researchDepth?: string }) => {
    const existing = await db.searchRule.findFirst({ where: { workspaceId: wsId, name: findName } })
    const payload = {
      workspaceId: wsId,
      name: data.name,
      description: data.description,
      enabled: true,
      priority: data.priority,
      countries: data.cities as unknown as object,
      cities: data.cities as unknown as object,
      industries: data.industries as unknown as object,
      services: data.services as unknown as object,
      keywords: data.keywords as unknown as object,
      excludedWords: data.excludedWords as unknown as object,
      sourceTypes: data.sourceTypes as unknown as object,
      minLeadScore: data.minLeadScore,
      startResearch: data.startResearch ?? true,
      researchDepth: (data.researchDepth ?? "DEEP") as never,
    }
    if (existing) { await db.searchRule.update({ where: { id: existing.id }, data: payload }); console.log(`  updated: ${data.name}`); return existing.id }
    const created = await db.searchRule.create({ data: payload })
    console.log(`  created: ${data.name}`)
    return created.id
  }

  await setRule("كافيهات القاهرة محتاجة POS", {
    name: "كافيهات ومطاعم محتاجة POS وطلبات أونلاين",
    description: "إشارات احتياج لأنظمة كاشير/طلبات/دليفري في كافيهات ومطاعم مصر",
    priority: 200,
    cities: ["Cairo", "Giza", "Alexandria"],
    industries: ["cafe", "restaurant"],
    services: ["pos", "ordering", "website"],
    keywords: ["محتاج كاشير", "عايز نظام طلبات", "cafe POS Egypt", "نظام دليفري للمطاعم"],
    excludedWords: ["وظيفة", "توظيف", "job", "مطلوب موظف"],
    sourceTypes: ["GOOGLE_SEARCH", "FACEBOOK", "REDDIT", "X"],
    minLeadScore: 65,
  })
  await setRule("عيادات محتاجة أنظمة", {
    name: "عيادات وأطباء محتاجين حجوزات وCRM",
    description: "عيادات أسنان وتخصصات فيها إشارات احتياج لأنظمة حجز ومتابعة مرضى",
    priority: 190,
    cities: ["Cairo", "Giza", "Alexandria", "Mansoura"],
    industries: ["clinic"],
    services: ["booking", "crm", "website"],
    keywords: ["عيادة محتاجة نظام حجز", "حجوزات اونلاين عيادة", "clinic booking system Egypt", "إدارة مرضى"],
    excludedWords: ["وظيفة", "توظيف", "تمرين", "job"],
    sourceTypes: ["GOOGLE_SEARCH", "FACEBOOK", "REDDIT", "LINKEDIN"],
    minLeadScore: 65,
  })
  await setRule("متاجر إلكترونية", {
    name: "براندات ومتاجر بيع أونلاين محتاجة متجر/ERP",
    description: "براندات بتبيع على إنستجرام/فيسبوك وفيها فوضى طلبات — فرصة متجر إلكتروني",
    priority: 180,
    cities: ["Cairo", "Alexandria", "Mansoura", "Tanta"],
    industries: ["ecommerce_brand", "retail"],
    services: ["ecommerce", "erp", "automation"],
    keywords: ["متجر الكتروني", "بيع اونلاين طلبات", "ecommerce Egypt", "متجر انستجرام طلبات مرتبة"],
    excludedWords: ["وظيفة", "توظيف", "job"],
    sourceTypes: ["GOOGLE_SEARCH", "INSTAGRAM", "FACEBOOK", "TIKTOK"],
    minLeadScore: 60,
  })
  await setRule("شركات بتوظف = بتكبر", {
    name: "شركات بتوظف — إشارات توسع (وظائف ولينكدإن)",
    description: "شركات مصر بتعمل وظائف في تقنية/تسويق/مبيعات = نية نمو وتوسع",
    priority: 150,
    cities: ["Cairo", "Giza", "Alexandria"],
    industries: ["retail", "restaurant", "clinic", "real_estate", "factory"],
    services: ["crm", "erp", "automation", "website"],
    keywords: ["we are hiring Egypt", "مطلوب مبرمج شركة", "وظيفة تسويق رقمي مصر", "hiring marketing Egypt"],
    excludedWords: ["beware", "scam"],
    sourceTypes: ["WEBSITE", "LINKEDIN", "NEWS"],
    minLeadScore: 55,
    startResearch: false,
    researchDepth: "QUICK",
  })
  await setRule("أخبار توسع الشركات", {
    name: "أخبار افتتاح فروع وتوسعات واستثمارات",
    description: "شركات نُشر عنها افتتاح/توسع/استثمار = وقت مثالي للتواصل",
    priority: 140,
    cities: ["Egypt"],
    industries: ["restaurant", "retail", "clinic", "gym", "factory"],
    services: ["pos", "crm", "erp", "website"],
    keywords: ["افتتاح فرع جديد", "توسع سلسلة مطاعم مصر", "استثمار شركة مصرية", "سلسلة فروع جديدة مصر"],
    excludedWords: ["وفاة", "حادث"],
    sourceTypes: ["NEWS", "GOOGLE_SEARCH"],
    minLeadScore: 55,
    startResearch: false,
    researchDepth: "QUICK",
  })
  await setRule("عقارات وجيم وصالونات", {
    name: "عقارات/جيم/صالونات محتاجة CRM وحجوزات",
    description: "مكاتب عقارات وجيمات وصالونات فيها إشارات احتياج لأنظمة إدارة",
    priority: 130,
    cities: ["Cairo", "Giza", "Alexandria"],
    industries: ["real_estate", "gym", "salon"],
    services: ["crm", "booking", "website", "marketing"],
    keywords: ["مكتب عقاري CRM", "جيم نظام اشتراكات", "صالون حجز اونلاين", "real estate CRM Egypt"],
    excludedWords: ["وظيفة", "توظيف", "job"],
    sourceTypes: ["GOOGLE_SEARCH", "FACEBOOK", "INSTAGRAM", "DIRECTORY"],
    minLeadScore: 55,
  })

  const counts = {
    sources: await db.source.count(),
    activeSources: await db.source.count({ where: { status: "ACTIVE" } }),
    rules: await db.searchRule.count(),
  }
  console.log(`\nReady: sources=${counts.sources} (active=${counts.activeSources}), rules=${counts.rules}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
