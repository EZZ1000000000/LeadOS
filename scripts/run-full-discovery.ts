/**
 * LeadOS — عدّاء الاكتشاف الكامل (تشغيل فعلي حي قبل النشر)
 * يشغّل محرك الاكتشاف الحقيقي على كل المنصات (11 مصدرًا) باستعلامات نوايا شراء حقيقية،
 * ويمرّر النتايج عبر نفس pipeline الدخول (تصنيف → dedup → Business/Lead → تقييم → بحث عميق).
 *
 * الاستخدام:  bun run scripts/run-full-discovery.ts [--platforms=FACEBOOK,X] [--queries-per=3]
 */
import { PrismaClient } from "@prisma/client"
import { runDiscovery } from "../src/lib/discovery"
import { ingestDiscoveredItems } from "../src/lib/queue"

const ownDb = new PrismaClient() // بدون لوجاستعلامات — للتقارير فقط

// ---- استعلامات نوايا حقيقية لكل منصة (عربي + إنجليزي، مصرية التثبيت) ----
const PLATFORM_QUERIES: Record<string, string[]> = {
  FACEBOOK: [
    "محتاج نظام كاشير لمطعمي",
    "عيادة محتاجة نظام حجز إلكتروني",
    "recommend cafe POS system Egypt",
  ],
  INSTAGRAM: [
    "متجر انستجرام طلبات مرتبة على الواتساب",
    "براند مصري بيع اونلاين طلبات",
    "Cairo brand online store instagram",
  ],
  X: [
    "محتاج مطور موقع مصر",
    "ترشيح شركة برمجة مصر",
    "recommend marketing agency Cairo",
  ],
  LINKEDIN: [
    "we are hiring Egypt sales team",
    "شركة مصرية بتوظف مبرمجين",
    "clinic manager hiring Egypt linkedin",
  ],
  REDDIT: [
    "recommend software agency Egypt reddit",
    "Egypt business software recommendation",
    "كافيه مصر محتاج نظام ادارة",
  ],
  TIKTOK: [
    "متجر مصري تيك توك طلبات",
    "مطعم مصري tiktok دليفري",
    "Egypt small brand tiktok shop",
  ],
  YOUTUBE: [
    "نظام كاشير مطاعم مصر مراجعة",
    "restaurant POS Egypt review",
    "عيادة اسنان مصر نظام حجوزات",
  ],
  DIRECTORY: [
    "عيادات اسنان القاهرة عناوين",
    "صالات رياضية مصر بيانات تواصل",
    "clinics Cairo directory contact",
  ],
  JOBS: [
    "wuzzuf مطلوب مبرمج شركة",
    "forasna وظائف مبيعات متجر",
    "hiring sales manager Egypt startup",
  ],
  NEWS: [
    "افتتاح فرع جديد مصر",
    "سلسلة مطاعم مصر توسع استثمار",
    "استثمار شركة مصرية 2026",
  ],
  GOOGLE_SEARCH: [
    "عيادة محتاجة نظام حجز مصر",
    "محتاج كاشير كافيه مصر",
    "looking for erp company Egypt",
  ],
}

// المجموعة الثانية — استعلامات بديلة للإعادة (روابط جديدة غير المعالجة سابقًا)
const PLATFORM_QUERIES_2: Record<string, string[]> = {
  INSTAGRAM: [
    "متجر ملابس انستجرام مصري طلبات",
    "مطعم انستجرام دليفري القاهرة",
    "handmade brand Egypt instagram ordering",
  ],
  LINKEDIN: [
    "شركة تقنية مصرية بتوظف",
    "hiring operations manager Egypt",
    "مطاعم مصر بتوظف مدير فروع",
  ],
  REDDIT: [
    "Egypt looking for web developer",
    "Cairo restaurant pos system advice reddit",
    "anyone recommend crm Egypt",
  ],
  YOUTUBE: [
    "مراجعة نظام محاسبة مصر",
    "erp system Egypt business review",
    "متجر الكتروني مصر شرح",
  ],
  JOBS: [
    "wuzzuf hiring web developer startup",
    "وظائف مدير تسويق شركة مصرية",
    "we are hiring account manager Egypt",
  ],
  NEWS: [
    "سلسلة كافيهات مصر افتتاح فروع جديدة",
    "شركة مصرية استثمار توسع أخبار",
    "مجموعة استثمارية مصر تفتتح",
  ],
  FACEBOOK: [
    "محتاج موقع لمحلي مصر",
    "جيم محتاج نظام اشتراكات",
    "looking for crm real estate Egypt",
  ],
  X: [
    "عايز تطبيق لمشروعي",
    "مطلوب وكالة تسويق مصر",
    "who can build website Cairo",
  ],
  TIKTOK: [
    "براند تيك توك مصر طلبات واتساب",
    "كافيه مصري tiktok",
    "Egypt store tiktok delivery",
  ],
  DIRECTORY: [
    "مكاتب عقارية مصر تواصل",
    "مطاعم القاهرة دليل أعمال",
    "gyms Cairo contact list",
  ],
  GOOGLE_SEARCH: [
    "صالون محتاج نظام حجز مصر",
    "شركة محتاجة erp مصر",
    "متجر محتاج نظام طلبات مصر",
  ],
}

// المجموعة الثالثة — استهداف خاص للمنصات ضعيفة التحويل (نوايا بأسلوب المنصة نفسها)
const PLATFORM_QUERIES_3: Record<string, string[]> = {
  LINKEDIN: [
    "hiring marketing manager Egypt",
    "توظيف مدير تسويق شركة مصرية",
    "looking for business development Egypt",
  ],
  REDDIT: [
    "r/egypt recommend web design company",
    "Egypt small business need software advice",
    "r/EgyptBusiness looking for developer",
  ],
  YOUTUBE: [
    "افتتاح كافيه جديد مصر",
    "تجربة عميل نظام مطاعم مصر",
    "Egypt small business owner interview",
  ],
}

// المجموعة الرابعة — ريدت: نوايا recommend/looking-for مع صناعات مصرية
const PLATFORM_QUERIES_4: Record<string, string[]> = {
  REDDIT: [
    "recommend a good gym in Cairo reddit",
    "looking for marketing agency Egypt reddit",
    "حد يعرف شركة برمجة كويسة مصر reddit",
  ],
}

// platform → نوع صف المصدر في جدول Source
const PLATFORM_SOURCE_TYPE: Record<string, string> = {
  FACEBOOK: "FACEBOOK",
  INSTAGRAM: "INSTAGRAM",
  X: "X",
  LINKEDIN: "LINKEDIN",
  REDDIT: "REDDIT",
  TIKTOK: "TIKTOK",
  YOUTUBE: "YOUTUBE",
  DIRECTORY: "DIRECTORY",
  JOBS: "WEBSITE",
  NEWS: "NEWS",
  GOOGLE_SEARCH: "GOOGLE_SEARCH",
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const args = process.argv.slice(2)
  const onlyPlatforms = args.find((a) => a.startsWith("--platforms="))?.split("=")[1]?.split(",")
  const queriesPer = parseInt(args.find((a) => a.startsWith("--queries-per="))?.split("=")[1] ?? "3", 10)
  const querySet = args.find((a) => a.startsWith("--set="))?.split("=")[1] === "2"
    ? PLATFORM_QUERIES_2
    : args.find((a) => a.startsWith("--set="))?.split("=")[1] === "3"
      ? PLATFORM_QUERIES_3
      : args.find((a) => a.startsWith("--set="))?.split("=")[1] === "4"
        ? PLATFORM_QUERIES_4
        : PLATFORM_QUERIES

  const ws = await ownDb.workspace.findFirst()
  if (!ws) throw new Error("No workspace found")
  console.log(`# Workspace: ${ws.name} (${ws.id})`)

  const sources = await ownDb.source.findMany({ where: { workspaceId: ws.id } })
  const sourceByType = new Map(sources.map((s) => [s.type, s]))

  const platforms = (onlyPlatforms?.length ? onlyPlatforms : Object.keys(PLATFORM_QUERIES)).filter(
    (p) => querySet[p],
  )

  console.log(`# Platforms: ${platforms.join(", ")}\n`)
  const results: Array<{ platform: string; items: number; created: number; duplicates: number; adapters: string[] }> = []

  for (const platform of platforms) {
    const source = sourceByType.get(PLATFORM_SOURCE_TYPE[platform])
    if (!source) {
      console.log(`⚠ ${platform}: لا يوجد صف مصدر — تخطي`)
      continue
    }
    const queries = querySet[platform].slice(0, queriesPer)
    const t0 = Date.now()
    let items: Awaited<ReturnType<typeof runDiscovery>>["items"] = []
    let adapters: string[] = []
    try {
      const res = await runDiscovery([platform], queries, 5)
      items = res.items
      adapters = res.adaptersUsed
    } catch (err) {
      console.log(`✗ ${platform}: فشل البحث — ${err instanceof Error ? err.message.slice(0, 120) : err}`)
      results.push({ platform, items: 0, created: 0, duplicates: 0, adapters: [] })
      continue
    }
    const searchMs = Date.now() - t0

    const { created, duplicates } = await ingestDiscoveredItems(ws.id, source, null, items)
    // تحديث lastRunAt للمصدر كدليل تشغيل حي
    await ownDb.source.update({ where: { id: source.id }, data: { lastRunAt: new Date(), lastError: null } })
    console.log(
      `✓ ${platform}: items=${items.length} leadsCreated=${created} duplicates=${duplicates} adapters=[${adapters.join(",")}] (${searchMs}ms)`,
    )
    results.push({ platform, items: items.length, created, duplicates, adapters })
    await sleep(1500) // لطفًا مع مزود البحث
  }

  // ملخص نهائي
  const totalItems = results.reduce((a, r) => a + r.items, 0)
  const totalCreated = results.reduce((a, r) => a + r.created, 0)
  const totalDupes = results.reduce((a, r) => a + r.duplicates, 0)
  const livePlatforms = results.filter((r) => r.items > 0).length
  console.log("\n=== SUMMARY ===")
  console.log(`platforms_run=${results.length} platforms_with_results=${livePlatforms}`)
  console.log(`items=${totalItems} leadsCreated=${totalCreated} duplicates=${totalDupes}`)
  const totalLeads = await ownDb.lead.count()
  console.log(`TOTAL_LEADS_NOW=${totalLeads}`)
  process.exit(0)
}

main().catch((e) => {
  console.error("FATAL:", e instanceof Error ? e.message : e)
  process.exit(1)
})
