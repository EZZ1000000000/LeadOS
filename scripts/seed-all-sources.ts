// LeadOS — السيد الكامل: حساب + ورشة + كل المصادر (22 نوع) + قواعد تغطي كل الأنواع
// DB فاضي حاليًا (بعد الwipe) — ده بيبنّي كل حاجة من الأول بشكل idempotent
// Run: bun run scripts/seed-all-sources.ts
import { PrismaClient } from "@prisma/client"
import { randomBytes, scryptSync } from "crypto"

const db = new PrismaClient()

// نفس صيغة src/lib/auth.ts: scrypt$salt$hash
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`
}

const EMAIL = "admin@leados.eg"
const PASSWORD = "Zizo@2026"

// كل أنواع المصادر — نشطة. GOOGLE_MAPS لوحده متوقف بأمانة (مفيش مفتاح maps/serper)
const ACTIVE_SOURCES: Array<{ type: string; name: string; config: object; cron: string }> = [
  { type: "FACEBOOK", name: "فيسبوك — جروبات وصفحات أصحاب الأعمال", config: { scope: "groups+pages", market: "Egypt" }, cron: "0 */2 * * *" },
  { type: "LINKEDIN", name: "لينكدإن — منشورات ووظائف صنّاع القرار", config: { scope: "posts+jobs+companies", market: "Egypt" }, cron: "30 */2 * * *" },
  { type: "X", name: "X (تويتر) — طلبات وترشيحات لحظية", config: { scope: "requests", market: "Egypt" }, cron: "45 */3 * * *" },
  { type: "REDDIT", name: "Reddit — r/egypt وr/EgyptBusiness نوايا شراء", config: { subreddits: ["egypt", "EgyptBusiness", "startups"] }, cron: "*/30 * * * *" },
  { type: "INSTAGRAM", name: "إنستجرام — براندات ومتاجر", config: { scope: "brands", market: "Egypt" }, cron: "15 */3 * * *" },
  { type: "TIKTOK", name: "تيك توك — براندات صاعدة", config: { scope: "brands", market: "Egypt" }, cron: "20 */4 * * *" },
  { type: "YOUTUBE", name: "يوتيوب — أعمال ومراجعات", config: { scope: "business+reviews" }, cron: "40 */4 * * *" },
  { type: "TELEGRAM", name: "تليجرام — قنوات أعمال واقتصاد مصرية (t.me/s حي)", config: { channels: ["egyptbusiness", "AlBorsaNews", "AlmalNews", "AkhbarEconomy", "BusinessEgypt", "marketing_egypt", "sadany"] }, cron: "5 */2 * * *" },
  { type: "GOOGLE_SEARCH", name: "بحث جوجل المفتوح — إشارات نوايا عامة", config: { freshness: "14d" }, cron: "*/20 * * * *" },
  { type: "WEBSITE", name: "مواقع ومنصات التوظيف — إشارات توسع (Wuzzuf/Forasna)", config: { signals: ["hiring", "expansion"] }, cron: "50 */6 * * *" },
  { type: "NEWS", name: "أخبار الأعمال — افتتاحات وتوسعات واستثمارات", config: { market: "Egypt" }, cron: "10 * * * *" },
  { type: "RSS", name: "RSS — فيدات أعمال مصرية (البورصة/وامدا/أموال الغد)", config: { feeds: ["alborsaanews.com", "wamda.com", "en.amwalalghad.com", "egyptianstreets.com"] }, cron: "25 * * * *" },
  { type: "DIRECTORY", name: "أدلة الأعمال المصرية — بيانات تواصل", config: { market: "Egypt" }, cron: "0 */6 * * *" },
  { type: "JOBS", name: "مواقع التوظيف — وظائف تقنية وتسويق ومبيعات", config: { signals: ["hiring"] }, cron: "35 */5 * * *" },
  { type: "MARKETPLACE", name: "مواقع البيع (OLX/دوبيزل/هتلا2ي) — بيزنسات بتبيع", config: { market: "Egypt" }, cron: "55 */5 * * *" },
  { type: "FREELANCE", name: "العمل الحر (مستقل/خمسات) — مشاريع بتدور تنفيذ", config: { platforms: ["mostaql", "khamsat", "bahr"] }, cron: "15 */4 * * *" },
  { type: "ADS_LIBRARY", name: "مكتبة إعلانات ميتا — صفحات بتصرف على إعلانات", config: { market: "Egypt" }, cron: "40 */6 * * *" },
  { type: "REVIEWS", name: "تقييمات ومراجعات — بيزنسات بتكبر أو بتعاني", config: { platforms: ["google_maps", "tripadvisor", "elmenus"] }, cron: "20 */6 * * *" },
  { type: "EVENTS", name: "المناسبات والمعارض — عارضين ورعايا (Cairo ICT...)", config: { events: ["cairoict", "egyta", "egyfoodexpo"] }, cron: "0 */8 * * *" },
  { type: "QUORA", name: "Quora عربي — أسئلة نوايا وترشيحات", config: { market: "Egypt" }, cron: "10 */5 * * *" },
  { type: "DISCORD", name: "ديسكورد — مجتمعات ستارت أب وفريلانسرز", config: { market: "Egypt+MENA" }, cron: "30 */8 * * *" },
]

// قواعد بحث — مجموعة المصادر مع بعض تغطي كل الأنواع النشطة
const RULES: Array<{
  name: string; description: string; priority: number
  sourceTypes: string[]; keywords: string[]
  cities: string[]; industries: string[]; services: string[]
}> = [
  {
    name: "نية شراء صريحة — سوشيال وويب",
    description: "ناس بتقول «محتاج/عايز» خدمات برمجة وتسويق وأنظمة — أعلى أولوية",
    priority: 200,
    sourceTypes: ["FACEBOOK", "GOOGLE_SEARCH", "X", "INSTAGRAM", "TIKTOK", "YOUTUBE"],
    keywords: [
      '"محتاج مبرمج" مصر', '"عايز حد يعمل لي موقع"', '"محتاج نظام كاشير"',
      '"عايز تطبيق لمشروعي"', '"مطلوب شركة برمجة" مصر', '"عايز متجر الكتروني"',
      '"بدور على شركة تسويق" مصر', '"محتاج CRM" مصر',
    ],
    cities: ["القاهرة", "الجيزة", "الاسكندرية"],
    industries: ["مطاعم", "عيادات", "متاجر", "صالونات"],
    services: ["نظام كاشير", "موقع إلكتروني", "تسويق رقمي"],
  },
  {
    name: "مجتمعات ومناقشات — رديت وتليجرام وكورا",
    description: "أسئلة وترشيحات في المجتمعات — نوايا قبل ما تتحول لصفقات",
    priority: 170,
    sourceTypes: ["REDDIT", "QUORA", "DISCORD", "TELEGRAM", "RSS"],
    keywords: [
      "looking for software agency recommendation",
      "need developer for my small business",
      "recommend POS system cafe restaurant",
      "شركات مصرية توسع استثمار",
      "بيزنس مصري محتاج أتمتة",
      "مطعم فروع جديدة مصر",
    ],
    cities: [],
    industries: [],
    services: [],
  },
  {
    name: "شركات بتكبر — لينكدإن وتوظيف وأخبار",
    description: "وظائف وافتتاحات وتوسعات = وقت الشراء المثالي",
    priority: 150,
    sourceTypes: ["LINKEDIN", "JOBS", "NEWS", "WEBSITE"],
    keywords: [
      "we are hiring Egypt marketing manager",
      "مطلوب مبرمج شركة مصر",
      "شركة مصرية تفتح فروع جديدة",
      "سلسلة مطاعم مصرية تتوسع",
      "استثمار شركة مصرية 2026",
      "مجموعة عيادات جديدة مصر",
    ],
    cities: ["Cairo", "Giza", "Alexandria"],
    industries: ["retail", "restaurant", "clinic", "real_estate"],
    services: ["crm", "erp", "website"],
  },
  {
    name: "سوق ومنصات عمل حر — نية تنفيذ مباشرة",
    description: "مشاريع منشورة على OLX ومستقل وخمسات ومكتبة الإعلانات = نية شراء دافئة",
    priority: 130,
    sourceTypes: ["MARKETPLACE", "FREELANCE", "ADS_LIBRARY"],
    keywords: [
      "مطلوب مطور موقع مشروع",
      "محتاج مصمم هوية بصرية مشروع",
      "عايز مطور تطبيق موبايل",
      "مطلوب نظام محاسبة شركة",
      "شركة بتعلن عن خدماتها أونلاين",
    ],
    cities: [],
    industries: [],
    services: [],
  },
  {
    name: "أدلة وتقييمات ومناسبات — قوائم استهداف",
    description: "أدلة أعمال ومراجعات ومعارض — بيزنسات حقيقية ببيانات تواصل",
    priority: 110,
    sourceTypes: ["DIRECTORY", "REVIEWS", "EVENTS"],
    keywords: [
      "مطاعم القاهرة الجديدة",
      "عيادات أسنان التجمع",
      "صالونات تجميل مدينة نصر",
      "cafes Zamalek Cairo",
      "Cairo ICT exhibitors companies",
      "فنادق وسياحة الغردقة",
    ],
    cities: [],
    industries: [],
    services: [],
  },
]

async function main() {
  // ---- 1) المستخدم ----
  let user = await db.user.findUnique({ where: { email: EMAIL } })
  if (!user) {
    user = await db.user.create({
      data: { email: EMAIL, name: "زيزو الأدمن", passwordHash: hashPassword(PASSWORD), role: "ADMIN", timezone: "Africa/Cairo" },
    })
    console.log(`✅ يوزر: ${EMAIL} / ${PASSWORD}`)
  } else console.log("⏭ يوزر موجود")

  // ---- 2) الورشة + العضوية ----
  let ws = await db.workspace.findFirst({ orderBy: { createdAt: "asc" } })
  if (!ws) {
    ws = await db.workspace.create({ data: { name: "Zizo HQ", slug: "zizo-hq", isActive: true } })
    console.log(`✅ ورشة: ${ws.name} (${ws.id})`)
  } else console.log("⏭ ورشة موجودة")
  await db.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: ws.id, userId: user.id } },
    update: { role: "OWNER" },
    create: { workspaceId: ws.id, userId: user.id, role: "OWNER" },
  })
  const wsId = ws.id

  // ---- 3) المصادر: كل الأنواع ----
  console.log("📡 المصادر:")
  for (const s of ACTIVE_SOURCES) {
    const existing = await db.source.findFirst({ where: { workspaceId: wsId, type: s.type } })
    const payload = { name: s.name, status: "ACTIVE" as const, config: s.config as object, scheduleCron: s.cron, lastError: null }
    if (existing) await db.source.update({ where: { id: existing.id }, data: payload })
    else await db.source.create({ data: { workspaceId: wsId, type: s.type as never, ...payload } })
    console.log(`  ✅ ${s.type} — ${s.name}`)
  }
  // خرائط جوجل: أمانة — من غير مفتاح مفيش بيانات خرائط حقيقية
  const maps = await db.source.findFirst({ where: { workspaceId: wsId, type: "GOOGLE_MAPS" } })
  if (maps) await db.source.update({ where: { id: maps.id }, data: { status: "PAUSED", lastError: "متوقف: أضف SERPER_API_KEY أو GOOGLE_MAPS_API_KEY لتشغيل اكتشاف الخرائط الحقيقي" } })
  else await db.source.create({
    data: {
      workspaceId: wsId, type: "GOOGLE_MAPS" as never, name: "خرائط جوجل — يحتاج مفتاح API", status: "PAUSED",
      config: { cities: ["Cairo", "Giza", "Alexandria"] } as object, scheduleCron: "0 */2 * * *",
      lastError: "متوقف: أضف SERPER_API_KEY أو GOOGLE_MAPS_API_KEY لتشغيل اكتشاف الخرائط الحقيقي",
    },
  })
  console.log(`  ⏸ GOOGLE_MAPS — متوقف بأمانة (مفيش مفتاح)`)

  // ---- 4) القواعد ----
  console.log("📏 القواعد:")
  for (const r of RULES) {
    const existing = await db.searchRule.findFirst({ where: { workspaceId: wsId, name: r.name } })
    const payload = {
      workspaceId: wsId, name: r.name, description: r.description, enabled: true, priority: r.priority,
      countries: ["Egypt"], cities: r.cities, industries: r.industries, services: r.services,
      keywords: r.keywords, excludedWords: ["وظيفة", "توظيف", "beware", "scam"],
      sourceTypes: r.sourceTypes, minLeadScore: 55, startResearch: true, researchDepth: "DEEP",
      scheduleCron: "*/20 * * * *",
    }
    if (existing) await db.searchRule.update({ where: { id: existing.id }, data: payload })
    else await db.searchRule.create({ data: payload as never })
    console.log(`  ✅ ${r.name} (${r.sourceTypes.length} أنواع مصادر)`)
  }

  // ---- تقرير ----
  const typesInDb = (await db.source.findMany({ where: { workspaceId: wsId }, select: { type: true } })).map((s) => s.type)
  const ruleTypes = new Set(RULES.flatMap((r) => r.sourceTypes))
  const uncovered = typesInDb.filter((t) => t !== "GOOGLE_MAPS" && t !== "OTHER" && !ruleTypes.has(t))
  console.log(`\n🎉 السيد خلص: ${typesInDb.length} مصدر | ${RULES.length} قواعد`)
  console.log(uncovered.length ? `⚠️ أنواع مش مغطاة بقواعد: ${uncovered.join(", ")}` : "✅ كل أنواع المصادر النشطة مغطاة بقواعد بحث")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
