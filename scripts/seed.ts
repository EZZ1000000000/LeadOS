// LeadOS — Demo seed: rich Arabic/Egyptian market data
// Run: bun run scripts/seed.ts
import { PrismaClient } from "@prisma/client"
import { hashPassword } from "../src/lib/auth"

const db = new PrismaClient()

const DEFAULT_STAGES = [
  { name: "جديد", position: 0, color: "#6b7280", probability: 10 },
  { name: "مؤهل", position: 1, color: "#0ea5e9", probability: 25 },
  { name: "تم التواصل", position: 2, color: "#8b5cf6", probability: 40 },
  { name: "رد عليك", position: 3, color: "#a855f7", probability: 50 },
  { name: "مهتم", position: 4, color: "#ec4899", probability: 60 },
  { name: "اجتماع", position: 5, color: "#f97316", probability: 70 },
  { name: "عرض سعر", position: 6, color: "#eab308", probability: 80 },
  { name: "تم الإغلاق", position: 7, color: "#22c55e", probability: 100 },
  { name: "خسارة", position: 8, color: "#ef4444", probability: 0 },
  { name: "تنمية علاقة", position: 9, color: "#14b8a6", probability: 30 },
]

const hours = (n: number) => new Date(Date.now() - n * 3600 * 1000)
const days = (n: number) => new Date(Date.now() - n * 86400 * 1000)

async function main() {
  console.log("Seeding LeadOS demo data...")
  await db.$transaction([
    db.auditLog.deleteMany(), db.alert.deleteMany(), db.automation.deleteMany(),
    db.job.deleteMany(), db.aiChatMessage.deleteMany(), db.aiChatSession.deleteMany(),
    db.aiRun.deleteMany(), db.aiProviderConfig.deleteMany(), db.competitor.deleteMany(),
    db.contactList.deleteMany(), db.savedView.deleteMany(), db.leadTag.deleteMany(), db.tag.deleteMany(),
    db.note.deleteMany(), db.task.deleteMany(), db.activity.deleteMany(), db.deal.deleteMany(),
    db.pipelineStage.deleteMany(), db.pipeline.deleteMany(), db.opportunity.deleteMany(),
    db.finding.deleteMany(), db.researchRun.deleteMany(), db.leadSource.deleteMany(),
    db.leadContent.deleteMany(), db.lead.deleteMany(), db.person.deleteMany(),
    db.review.deleteMany(), db.socialProfile.deleteMany(), db.websitePage.deleteMany(),
    db.website.deleteMany(), db.businessSource.deleteMany(), db.branch.deleteMany(),
    db.business.deleteMany(), db.contentItem.deleteMany(), db.searchRuleAction.deleteMany(),
    db.searchRule.deleteMany(), db.searchJob.deleteMany(), db.source.deleteMany(),
    db.workspaceMember.deleteMany(), db.workspace.deleteMany(),
    db.user.deleteMany(),
  ])

  // ---- Users & Workspace ----
  const owner = await db.user.create({
    data: {
      email: "admin@leados.ai",
      name: "أحمد المدير",
      passwordHash: hashPassword("123456"),
      role: "OWNER",
    },
  })
  const agent = await db.user.create({
    data: {
      email: "sara@leados.ai",
      name: "سارة مندوبة المبيعات",
      passwordHash: hashPassword("123456"),
      role: "AGENT",
    },
  })

  const workspace = await db.workspace.create({
    data: {
      name: "LeadOS — وكالة النمو الرقمي",
      slug: "leados-demo",
      settings: { scoringWeights: { intent: 30, fit: 20 }, timezone: "Africa/Cairo" } as object,
      members: {
        create: [
          { userId: owner.id, role: "OWNER" },
          { userId: agent.id, role: "MEMBER" },
        ],
      },
    },
  })
  const wsId = workspace.id

  await db.pipeline.create({
    data: {
      workspaceId: wsId,
      name: "خط المبيعات الرئيسي",
      isDefault: true,
      stages: { create: DEFAULT_STAGES },
    },
  })

  // ---- Sources ----
  const srcGoogle = await db.source.create({
    data: { workspaceId: wsId, type: "GOOGLE_MAPS", name: "خرائط جوجل — القاهرة الكبرى", status: "ACTIVE", scheduleCron: "0 */1 * * *", lastRunAt: hours(1), config: { cities: ["Cairo", "Giza", "Alexandria"] } as object },
  })
  const srcWeb = await db.source.create({
    data: { workspaceId: wsId, type: "GOOGLE_SEARCH", name: "بحث الويب — إشارات النوايا", status: "ACTIVE", scheduleCron: "*/15 * * * *", lastRunAt: hours(1), config: { freshness: "14d" } as object },
  })
  const srcFacebook = await db.source.create({
    data: { workspaceId: wsId, type: "FACEBOOK", name: "جروبات فيسبوك — أصحاب الأعمال", status: "PAUSED", lastError: "بانتظار مراجعة سياسات الوصول", lastRunAt: days(3) },
  })
  const srcReddit = await db.source.create({
    data: { workspaceId: wsId, type: "REDDIT", name: "Reddit — r/Egypt Business", status: "ACTIVE", scheduleCron: "*/30 * * * *", lastRunAt: hours(2) },
  })
  const srcNews = await db.source.create({
    data: { workspaceId: wsId, type: "NEWS", name: "أخبار الأعمال والاستثمار", status: "ACTIVE", scheduleCron: "0 * * * *", lastRunAt: hours(3) },
  })
  await db.source.create({
    data: { workspaceId: wsId, type: "LINKEDIN", name: "LinkedIn — صنّاع القرار", status: "DISABLED" },
  })

  // ---- Search Rules ----
  const ruleCafes = await db.searchRule.create({
    data: {
      workspaceId: wsId,
      name: "كافيهات القاهرة محتاجة POS",
      description: "كافيهات ومطاعم فيها إشارات احتياج لأنظمة كاشير أو طلبات",
      enabled: true,
      priority: 200,
      countries: ["Egypt"] as unknown as object,
      cities: ["Cairo", "Giza"] as unknown as object,
      industries: ["cafe", "restaurant"] as unknown as object,
      services: ["pos", "ordering", "website"] as unknown as object,
      keywords: ["محتاج كاشير", "عايز نظام طلبات", "cafe POS Egypt"] as unknown as object,
      excludedWords: ["وظيفة", "توظيف", "job"] as unknown as object,
      sourceTypes: ["GOOGLE_SEARCH", "GOOGLE_MAPS", "FACEBOOK"] as unknown as object,
      minLeadScore: 70,
      researchDepth: "DEEP",
    },
  })
  const ruleClinics = await db.searchRule.create({
    data: {
      workspaceId: wsId,
      name: "عيادات محتاجة نظام حجوزات",
      description: "عيادات أسنان وتجميل — حجز يدوي = فرصة",
      enabled: true,
      priority: 150,
      cities: ["Cairo", "Alexandria"] as unknown as object,
      industries: ["clinic"] as unknown as object,
      services: ["booking", "crm"] as unknown as object,
      keywords: ["عيادة حجز", "clinic booking system"] as unknown as object,
      sourceTypes: ["GOOGLE_SEARCH", "GOOGLE_MAPS"] as unknown as object,
      researchDepth: "QUICK",
    },
  })
  await db.searchRule.create({
    data: {
      workspaceId: wsId,
      name: "متاجر تجزئة محتاجة ERP/متجرة",
      enabled: false,
      priority: 100,
      cities: ["Cairo"] as unknown as object,
      industries: ["retail"] as unknown as object,
      services: ["erp", "ecommerce"] as unknown as object,
      sourceTypes: ["GOOGLE_SEARCH"] as unknown as object,
    },
  })

  // ---- Businesses ----
  interface BizSpec {
    name: string; industry: string; category: string; city: string; address: string
    rating: number; reviewCount: number; phone: string; website?: string
    hasWhatsapp?: boolean; hasBooking?: boolean; hasOrdering?: boolean; hasEcommerce?: boolean
    uxScore?: number; mobileScore?: number; branches: number
    social?: Array<{ type: string; handle: string; followers: number }>
    reviews: Array<{ author: string; rating: number; text: string; pains: string[]; d: number }>
  }
  const bizSpecs: BizSpec[] = [
    {
      name: "كافيه بينا — المعادي", industry: "cafe", category: "Coffee shop", city: "القاهرة",
      address: "9 شارع 206، المعادي، القاهرة", rating: 4.6, reviewCount: 842, phone: "+201001234567",
      branches: 2, uxScore: 48, mobileScore: 42,
      social: [{ type: "INSTAGRAM", handle: "beana.cafe", followers: 15400 }],
      reviews: [
        { author: "منى عبد الله", rating: 2, text: "القهوة حلوة بس الطلب بياخد وقت طويل جدًا في الويك إند، مفيش نظام طلبات واضح", pains: ["بطء الطلب", "ازدحام بدون تنظيم"], d: 4 },
        { author: "كريم مصطفى", rating: 5, text: "أحسن لاتيه في المعادي والجلسة مريحة", pains: [], d: 9 },
        { author: "هدى سامي", rating: 3, text: "الحجز مفيش أونلاين، لازم تتصل وتستنى", pains: ["الحجز هاتفي فقط"], d: 15 },
      ],
    },
    {
      name: "مطعم الذوق الرفيع", industry: "restaurant", category: "Restaurant", city: "الجيزة",
      address: "شارع جامعة الدول العربية، المهندسين، الجيزة", rating: 4.3, reviewCount: 1284, phone: "+201112233445",
      website: "https://thatawelfy.example.eg", hasWhatsapp: false, hasOrdering: false, uxScore: 55, mobileScore: 38,
      branches: 3,
      reviews: [
        { author: "أحمد فؤاد", rating: 2, text: "الأكل ممتاز لكن التوصيل بياخد ساعة ونص، مفيش تطبيق طلبات", pains: ["تأخير التوصيل", "مفيش تتبع للطلب"], d: 2 },
        { author: "سلمى حسن", rating: 1, text: "الطلب اتلغى مرتين! محتاجين نظام طلبات محترم", pains: ["إلغاء طلبات", "تواصل ضعيف"], d: 6 },
        { author: "محمود رشاد", rating: 4, text: "المكان عائلي وجميل، الأسعار معقولة", pains: [], d: 20 },
      ],
    },
    {
      name: "عيادة د. سارة لطب الأسنان", industry: "clinic", category: "Dental clinic", city: "القاهرة",
      address: "90 الشارع، التجمع الخامس، القاهرة", rating: 4.8, reviewCount: 312, phone: "+201555667788",
      branches: 1,
      reviews: [
        { author: "نورهان علي", rating: 5, text: "دكتورة متمرسة والتعامل راقي جدًا", pains: [], d: 3 },
        { author: "طارق منصور", rating: 3, text: "الحجز على التليفون بس وبتكون الخطوط مشغولة، ياريت حجز أونلاين", pains: ["الحجز هاتفي فقط", "انتظار طويل"], d: 5 },
      ],
    },
    {
      name: "متجر تيك نو للإلكترونيات", industry: "retail", category: "Electronics store", city: "الإسكندرية",
      address: "طريق الحرية، سموحة، الإسكندرية", rating: 4.1, reviewCount: 524, phone: "+201234567890",
      website: "https://technow.example.eg", hasEcommerce: false, uxScore: 40, mobileScore: 35, branches: 3,
      reviews: [
        { author: "عمر خالد", rating: 2, text: "الأسعار كويسة بس المخزون دايمًا مش متحدث، بتسأل وتقعد تنتظر", pains: ["مخزون يدوي", "معلومات غير محدثة"], d: 7 },
        { author: "دينا ياسر", rating: 4, text: "فرع سموحة منظم والموظفين متعاونين", pains: [], d: 11 },
      ],
    },
    {
      name: "جيم فيت لايف", industry: "gym", category: "Gym", city: "القاهرة",
      address: "شارع الميرغني، مصر الجديدة، القاهرة", rating: 4.4, reviewCount: 698, phone: "+201098765432",
      website: "https://fitlive.example.eg", uxScore: 62, mobileScore: 50, branches: 2,
      reviews: [
        { author: "يوسف عادل", rating: 4, text: "أجهزة حديثة والمدربين محترمين", pains: [], d: 8 },
        { author: "مي شريف", rating: 3, text: "الاشتراكات بتتجدد يدوي كل شهر، محتاجين تطبيق", pains: ["إدارة اشتراكات يدوية"], d: 14 },
      ],
    },
    {
      name: "صالون إليت للتجميل", industry: "salon", category: "Beauty salon", city: "القاهرة الجديدة",
      address: "التجمع الأول، القاهرة الجديدة", rating: 4.5, reviewCount: 233, phone: "+201277766554",
      branches: 1,
      reviews: [
        { author: "رهف مصطفى", rating: 5, text: "أفضل صالون جربته، الحجز واتساب بس سريعين في الرد", pains: [], d: 6 },
        { author: "سانا جمال", rating: 3, text: "مفيش صفحة موقع للأسعار والخدمات، كله سؤال وجواب", pains: ["لا يوجد موقع", "أسعار غير معلنة"], d: 10 },
      ],
    },
    {
      name: "براند توتي للأزياء", industry: "ecommerce_brand", category: "Clothing brand", city: "القاهرة",
      address: "أونلاين فقط — شحن لكل مصر", rating: 4.2, reviewCount: 415, phone: "+201066677889",
      website: "https://toty.example.eg", hasEcommerce: false, hasWhatsapp: true, uxScore: 30, mobileScore: 28, branches: 0,
      reviews: [
        { author: "مريم سيد", rating: 2, text: "الطلبات على انستجرام ودايمًا بيحصل لخبطة في المقاسات والتوصيل", pains: ["طلبات يدوية", "لخبطة مقاسات", "تأخير شحن"], d: 1 },
        { author: "أسماء طارق", rating: 4, text: "الخامات حلوة والتغليف شيك", pains: [], d: 12 },
      ],
    },
    {
      name: "مكتب النخبة العقارية", industry: "real_estate", category: "Real estate agency", city: "التجمع الخامس",
      address: "الرحاب، التجمع الخامس", rating: 3.9, reviewCount: 187, phone: "+201500112233",
      website: "https://elite-realestate.example.eg", uxScore: 58, mobileScore: 44, branches: 2,
      reviews: [
        { author: "حسام الدين", rating: 3, text: "وحدات كتير بس المتابعة ضعيفة، بيردوا متأخر على الرسايل", pains: ["متابعة عملاء ضعيفة", "تأخير رد"], d: 5 },
        { author: "ليليان وليم", rating: 4, text: "تعامل محترم والعقود واضحة", pains: [], d: 18 },
      ],
    },
    {
      name: "مخبز وسنابل البلدي", industry: "restaurant", category: "Bakery", city: "الجيزة",
      address: "شارع الهرم، الجيزة", rating: 4.7, reviewCount: 956, phone: "+201233344556",
      branches: 4,
      reviews: [
        { author: "أم يوسف", rating: 5, text: "أحسن بلدي في المنطقة وطازة طول اليوم", pains: [], d: 2 },
        { author: "زياد فتحي", rating: 4, text: "الازدحام شديد الصبح، لو فيه طلب مسبق هيبقى أحسن", pains: ["ازدحام بدون نظام طلب"], d: 8 },
      ],
    },
    {
      name: "عيادة النور للأسنان والابتسامة", industry: "clinic", category: "Dental clinic", city: "الإسكندرية",
      address: "جامعة سان جورج، سموحة، الإسكندرية", rating: 4.6, reviewCount: 274, phone: "+201111223344",
      website: "https://alnoor-dental.example.eg", hasBooking: true, uxScore: 70, mobileScore: 65, branches: 2,
      reviews: [
        { author: "هدى إبراهيم", rating: 5, text: "نظام الحجز أونلاين سهل جدًا والرد فوري", pains: [], d: 4 },
        { author: "كريم عزمي", rating: 4, text: "استقبال محترم والتسعير واضح", pains: [], d: 16 },
      ],
    },
  ]

  const bizMap = new Map<string, string>()
  for (const [i, spec] of bizSpecs.entries()) {
    const mapsPlaceId = `ChIJ${(i + 7) * 7919}demoPLACE`
    const business = await db.business.create({
      data: {
        workspaceId: wsId,
        name: spec.name,
        category: spec.category,
        industry: spec.industry,
        description: `${spec.category} في ${spec.city}`,
        country: "Egypt",
        city: spec.city,
        address: spec.address,
        latitude: 30.0 + i * 0.01,
        longitude: 31.2 + i * 0.01,
        phone: spec.phone,
        email: `info@${spec.name.replace(/\s/g, "")}.example.eg`,
        websiteUrl: spec.website,
        mapsUrl: `https://www.google.com/maps/place/?q=place_id:${mapsPlaceId}`,
        mapsPlaceId,
        rating: spec.rating,
        reviewCount: spec.reviewCount,
        openingHours: { open: "09:00", close: "23:00" } as object,
        employeeCount: 5 + i * 3,
        businessSources: { create: { sourceType: "GOOGLE_MAPS", sourceUrl: `https://maps.google.com/?q=${encodeURIComponent(spec.name)}`, externalId: mapsPlaceId } },
        branches: {
          create: Array.from({ length: spec.branches }, (_, b) => ({
            name: `فرع ${b + 1}`,
            city: spec.city,
            address: `${spec.address} — ${b + 1}`,
          })),
        },
      },
    })
    bizMap.set(spec.name, business.id)

    if (spec.website) {
      await db.website.create({
        data: {
          businessId: business.id,
          url: spec.website,
          title: spec.name,
          description: `${spec.category} — ${spec.city}`,
          language: "ar",
          cms: i % 2 === 0 ? "WordPress" : "Custom",
          technologies: ["Google Analytics"] as unknown as object,
          performanceScore: 40 + i * 3,
          mobileScore: spec.mobileScore ?? 50,
          seoScore: 45 + i * 2,
          uxScore: spec.uxScore ?? 55,
          sslValid: true,
          hasWhatsapp: spec.hasWhatsapp ?? false,
          hasBooking: spec.hasBooking ?? false,
          hasOrdering: spec.hasOrdering ?? false,
          hasEcommerce: spec.hasEcommerce ?? false,
          crawledAt: days(1),
          auditData: {
            issues: [
              ...((spec.mobileScore ?? 50) < 60 ? ["تجربة موبايل ضعيفة"] : []),
              ...(!spec.hasOrdering && spec.industry === "restaurant" ? ["لا يوجد نظام طلبات أونلاين"] : []),
              ...(!spec.hasBooking && spec.industry === "clinic" ? ["لا يوجد حجز مواعيد"] : []),
              "لا يوجد CTA واضح",
            ],
          } as object,
        },
      })
    }

    for (const s of spec.social ?? []) {
      await db.socialProfile.create({
        data: { businessId: business.id, sourceType: s.type as never, profileUrl: `https://${s.type.toLowerCase()}.com/${s.handle}`, handle: s.handle, displayName: spec.name, followerCount: s.followers, postCount: 120 + i * 10 },
      })
    }

    for (const r of spec.reviews) {
      await db.review.create({
        data: {
          businessId: business.id,
          sourceType: "GOOGLE_MAPS",
          externalId: `rev-${business.id.slice(-6)}-${r.author.slice(0, 4)}`,
          authorName: r.author,
          rating: r.rating,
          text: r.text,
          publishedAt: days(r.d),
          sentiment: r.rating >= 4 ? "POSITIVE" : r.rating === 3 ? "NEUTRAL" : "NEGATIVE",
          sentimentScore: r.rating >= 4 ? 0.8 : r.rating === 3 ? 0.1 : -0.6,
          topics: ["خدمة", "جودة"] as unknown as object,
          painPoints: r.pains as unknown as object,
        },
      })
    }
  }

  // ---- Leads ----
  interface LeadSpec {
    biz: string; status: string; temperature: string; intent: string; sourceType: string
    intentScore: number; urgencyScore: number; score: number; services: string[]; pains: string[]
    summary: string; whyNow: string; nextAction: string; assignedTo?: string
    lastContactedDays?: number; followUpDays?: number
    opportunities: Array<{ service: string; title: string; desc: string; score: number }>
    withResearch?: boolean
  }
  const leadSpecs: LeadSpec[] = [
    {
      biz: "مطعم الذوق الرفيع", status: "INTERESTED", temperature: "HOT", intent: "VERY_HIGH", sourceType: "GOOGLE_MAPS",
      intentScore: 95, urgencyScore: 90, score: 93, services: ["ordering", "pos"], pains: ["تأخير التوصيل", "إلغاء طلبات"],
      summary: "مطعم 3 فروع بتقييم 4.3 و1284 مراجعة — شكاوى متكررة على التوصيل والطلبات اليدوية بدون نظام أونلاين.",
      whyNow: "شكاوى التوصيل تتصاعد في آخر أسبوعين والمطعم بيفقد عملاء", nextAction: "عرض Demo لنظام طلبات متكامل مع POS", assignedTo: agent.id,
      lastContactedDays: 2, followUpDays: 1,
      opportunities: [
        { service: "ordering", title: "نظام طلبات أونلاين", desc: "شكاوى متكررة على الطلبات والتوصيل اليدوي", score: 95 },
        { service: "pos", title: "نظام كاشير POS", desc: "3 فروع محتاجة إدارة موحدة", score: 89 },
        { service: "website", title: "تحسين الموقع", desc: "تجربة موبايل ضعيفة 38/100", score: 84 },
      ],
      withResearch: true,
    },
    {
      biz: "كافيه بينا — المعادي", status: "QUALIFIED", temperature: "HOT", intent: "HIGH", sourceType: "SOCIAL",
      intentScore: 85, urgencyScore: 80, score: 91, services: ["pos", "booking"], pains: ["بطء الطلب", "ازدحام بدون تنظيم"],
      summary: "كافيه فتح فرعًا ثانيًا — فرعان بدون POS موحد وطوابير طويلة في الويك إند.",
      whyNow: "التوسع لفرع جديد = وقت مثالي لتثبيت الأنظمة", nextAction: "اتصال تعريفي بعرض POS للفرعين", assignedTo: agent.id,
      followUpDays: 2,
      opportunities: [
        { service: "pos", title: "نظام كاشير POS", desc: "فرعان بدون نظام موحد", score: 92 },
        { service: "booking", title: "نظام حجز طاولات", desc: "شكاوى انتظار بدون حجز", score: 78 },
      ],
      withResearch: true,
    },
    {
      biz: "عيادة د. سارة لطب الأسنان", status: "NEW", temperature: "WARM", intent: "HIGH", sourceType: "GOOGLE_MAPS",
      intentScore: 80, urgencyScore: 65, score: 86, services: ["booking", "crm"], pains: ["الحجز هاتفي فقط"],
      summary: "عيادة أسنان بتقييم 4.8 — الحجز هاتفي فقط وخطوط مشغولة، مرضى يشتكون من الانتظار.",
      whyNow: "شكوى الحجز الهاتفي ظهرت في مراجعة حديثة", nextAction: "رسالة واتساب تعريفية بنظام حجز",
      opportunities: [
        { service: "booking", title: "نظام حجوزات أونلاين", desc: "الحجز هاتفي فقط", score: 90 },
        { service: "crm", title: "CRM للمرضى", desc: "متابعة المواعيد والتذكيرات", score: 72 },
      ],
    },
    {
      biz: "براند توتي للأزياء", status: "CONTACTED", temperature: "WARM", intent: "HIGH", sourceType: "SOCIAL",
      intentScore: 85, urgencyScore: 75, score: 84, services: ["ecommerce", "automation"], pains: ["طلبات يدوية", "لخبطة مقاسات"],
      summary: "براند أزياء يبيع عبر انستجرام — لخبطة طلبات ومقاسات، محتاج متجر إلكتروني كامل.",
      whyNow: "الطلبات بتزيد والمشاكل بتتضاعف", nextAction: "إرسال عرض متجر إلكتروني + ربط شحن", assignedTo: agent.id,
      lastContactedDays: 3,
      opportunities: [
        { service: "ecommerce", title: "متجر إلكتروني متكامل", desc: "البيع الحالي يدوي عبر انستجرام", score: 93 },
        { service: "automation", title: "أتمتة واتساب للطلبات", desc: "تأكيد طلبات آلي", score: 80 },
      ],
    },
    {
      biz: "متجر تيك نو للإلكترونيات", status: "REPLIED", temperature: "WARM", intent: "MEDIUM", sourceType: "DISCOVERY",
      intentScore: 60, urgencyScore: 55, score: 76, services: ["erp", "ecommerce"], pains: ["مخزون يدوي"],
      summary: "متجر إلكترونيات 3 فروع — مخزون يدوي ومتاجر غير مفعلة على الموقع.",
      whyNow: "3 فروع = تعقيد مخزون يستدعي ERP", nextAction: "اجتماع تعريفي عن ERP",
      lastContactedDays: 5,
      opportunities: [
        { service: "erp", title: "ERP للمخزون", desc: "إدارة مخزون يدوية لـ3 فروع", score: 85 },
        { service: "ecommerce", title: "تفعيل متجر إلكتروني", desc: "الموقع بدون تجارة إلكترونية", score: 75 },
      ],
    },
    {
      biz: "مكتب النخبة العقارية", status: "NEW", temperature: "WARM", intent: "MEDIUM", sourceType: "WEBSITE",
      intentScore: 55, urgencyScore: 50, score: 72, services: ["crm"], pains: ["متابعة عملاء ضعيفة"],
      summary: "مكتب عقاري — متابعة عملاء ضعيفة ورد متأخر على الرسايل.",
      whyNow: "شكاوى الرد المتأخر تؤثر على إغلاق الصفقات", nextAction: "عرض CRM عقاري بسيط",
      opportunities: [
        { service: "crm", title: "CRM عقاري", desc: "متابعة العملاء والمعاينات", score: 82 },
      ],
    },
    {
      biz: "جيم فيت لايف", status: "NURTURE", temperature: "COLD", intent: "MEDIUM", sourceType: "DISCOVERY",
      intentScore: 45, urgencyScore: 35, score: 58, services: ["mobile_app"], pains: ["إدارة اشتراكات يدوية"],
      summary: "جيم باشتراكات يدوية — مهتم بتطبيق لكن الميزانية مؤجلة.",
      whyNow: "موسم الاشتراكات الجديدة قرب", nextAction: "متابعة بعد شهر بعرض تقسيط",
      lastContactedDays: 10,
      opportunities: [
        { service: "mobile_app", title: "تطبيق اشتراكات الجيم", desc: "تجديد يدوي شهري", score: 70 },
      ],
    },
    {
      biz: "صالون إليت للتجميل", status: "NEW", temperature: "WARM", intent: "MEDIUM", sourceType: "GOOGLE_MAPS",
      intentScore: 50, urgencyScore: 45, score: 65, services: ["website", "booking"], pains: ["لا يوجد موقع"],
      summary: "صالون تجميل بدون موقع إطلاقًا — الحجز واتساب فقط.",
      whyNow: "لا يوجد أي حضور رقمي خارج المابس", nextAction: "عرض باقة موقع + حجز بسيط",
      opportunities: [
        { service: "website", title: "موقع تعريفي بالخدمات", desc: "لا يوجد موقع ولا أسعار معلنة", score: 78 },
      ],
    },
    {
      biz: "مخبز وسنابل البلدي", status: "LOST", temperature: "COLD", intent: "LOW", sourceType: "GOOGLE_MAPS",
      intentScore: 30, urgencyScore: 20, score: 38, services: ["ordering"], pains: ["ازدحام بدون نظام طلب"],
      summary: "مخبز بلدي — مشغول بالتشغيل التقليدي، غير مهتم حاليًا بالتحول الرقمي.",
      whyNow: "—", nextAction: "إعادة تواصل بعد 6 أشهر",
      lastContactedDays: 20,
      opportunities: [],
    },
    {
      biz: "عيادة النور للأسنان والابتسامة", status: "WON", temperature: "WARM", intent: "HIGH", sourceType: "REFERRAL",
      intentScore: 75, urgencyScore: 60, score: 80, services: ["crm"], pains: [],
      summary: "عيادة مجهزة أونلاين — كسبناها كعميلة CRM بعد ترشيح من عميل آخر.",
      whyNow: "ترشيح مباشر من عميل حالي", nextAction: "بدء Onboarding نظام CRM",
      lastContactedDays: 4, assignedTo: agent.id,
      opportunities: [],
    },
  ]

  for (const [i, spec] of leadSpecs.entries()) {
    const businessId = bizMap.get(spec.biz)!
    const lead = await db.lead.create({
      data: {
        workspaceId: wsId,
        businessId,
        assignedToId: spec.assignedTo ?? null,
        createdById: owner.id,
        status: spec.status as never,
        temperature: spec.temperature as never,
        intent: spec.intent as never,
        leadSourceType: spec.sourceType as never,
        intentScore: spec.intentScore,
        urgencyScore: spec.urgencyScore,
        fitScore: 65 + i * 3,
        confidenceScore: 80,
        score: spec.score,
        serviceNeeds: spec.services as unknown as object,
        painPoints: spec.pains as unknown as object,
        summary: spec.summary,
        whyNow: spec.whyNow,
        nextBestAction: spec.nextAction,
        firstSeenAt: days(14 - i),
        lastSeenAt: days(Math.max(0, 5 - i)),
        lastContactedAt: spec.lastContactedDays ? days(spec.lastContactedDays) : null,
        nextFollowUpAt: spec.followUpDays ? new Date(Date.now() + spec.followUpDays * 86400 * 1000) : null,
        convertedAt: spec.status === "WON" ? days(3) : null,
        lostReason: spec.status === "LOST" ? "غير مهتم بالتحول الرقمي حاليًا" : null,
      },
    })

    await db.leadSource.create({
      data: { leadId: lead.id, sourceType: spec.sourceType as never, label: spec.sourceType === "GOOGLE_MAPS" ? "خرائط جوجل" : "اكتشاف اجتماعي", sourceUrl: `https://maps.google.com/?q=${encodeURIComponent(spec.biz)}` },
    })

    for (const opp of spec.opportunities) {
      await db.opportunity.create({
        data: {
          workspaceId: wsId, leadId: lead.id, businessId,
          service: opp.service, title: opp.title, description: opp.desc,
          score: opp.score, confidence: 80 + (opp.score % 15),
          status: spec.status === "WON" ? "WON" : "OPEN",
          reason: opp.desc,
          whyNow: spec.whyNow,
        },
      })
    }

    await db.activity.create({
      data: { workspaceId: wsId, leadId: lead.id, type: "SYSTEM", subject: "اكتشاف", body: `تم اكتشاف العميل عبر ${spec.sourceType}`, occurredAt: days(14 - i) },
    })
    await db.activity.create({
      data: { workspaceId: wsId, leadId: lead.id, type: "AI_ACTION", subject: "تحديث Lead Score", body: `النتيجة النهائية: ${spec.score} (${spec.temperature})`, occurredAt: days(13 - i) },
    })
    if (spec.lastContactedDays) {
      await db.activity.create({
        data: { workspaceId: wsId, leadId: lead.id, userId: spec.assignedTo ?? owner.id, type: "WHATSAPP", subject: "تواصل أول", body: "تم إرسال رسالة تعريفية بعرضنا", occurredAt: days(spec.lastContactedDays) },
      })
    }

    await db.note.create({
      data: { workspaceId: wsId, leadId: lead.id, userId: owner.id, body: `ملاحظة أولية: ${spec.nextAction}`, createdAt: days(12 - i) },
    })

    await db.task.create({
      data: {
        workspaceId: wsId, leadId: lead.id, assignedToId: spec.assignedTo ?? owner.id,
        title: spec.status === "WON" ? "بدء Onboarding" : `متابعة ${spec.biz}`,
        description: spec.nextAction,
        status: spec.status === "WON" ? "IN_PROGRESS" : "TODO",
        priority: spec.score >= 85 ? 90 : 50,
        dueAt: spec.followUpDays ? new Date(Date.now() + spec.followUpDays * 86400 * 1000) : new Date(Date.now() + 3 * 86400 * 1000),
        createdAt: days(2),
      },
    })

    if (spec.withResearch) {
      const run = await db.researchRun.create({
        data: {
          workspaceId: wsId, leadId: lead.id, depth: "DEEP",
          status: "COMPLETED", requestedById: owner.id,
          startedAt: hours(30), completedAt: hours(29), progress: 100,
          summary: spec.summary,
          whyNow: spec.whyNow,
          recommendedServices: spec.services as unknown as object,
          scoreBefore: spec.score - 8, scoreAfter: spec.score,
        },
      })
      const f = async (type: string, category: string, title: string, statement: string, conf: string, cs: number) => {
        await db.finding.create({
          data: { workspaceId: wsId, researchRunId: run.id, leadId: lead.id, type: type as never, category, title, statement, confidence: conf as never, confidenceScore: cs, observedAt: hours(29) },
        })
      }
      await f("FACT", "identity", "تأكيد هوية النشاط", `${spec.biz} — نشاط تجاري موثق في مصر`, "VERY_HIGH", 95)
      await f("FACT", "maps", "تقييم خرائط جوجل", "تقييم قوي بعدد مراجعات مرتفع", "VERY_HIGH", 96)
      await f("OPPORTUNITY", "website", "فجوات الحضور الرقمي", "فجوات واضحة: طلبات/حجز/موقع", "HIGH", 88)
      await f("SIGNAL", "reviews", "شكاوى متكررة", spec.pains.join("، ") || "لا شكاوى جوهرية", "MEDIUM", 75)
    }
  }

  // Running research for a NEW clinic lead (Research Center progress demo)
  const newestLead = await db.lead.findFirst({ where: { workspaceId: wsId, status: "NEW", business: { industry: "clinic" } } })
  if (newestLead) {
    await db.researchRun.create({
      data: { workspaceId: wsId, leadId: newestLead.id, depth: "ULTRA_DEEP", status: "RUNNING", progress: 55, startedAt: hours(1), requestedById: owner.id },
    })
  }

  // ---- Content items (live feed) ----
  const feedItems = [
    { source: srcWeb, title: "كافيه بينا — المعادي", body: "كافيه بينا فتح فرع تاني في المعادي وناقصنا نظام كاشير POS للفرعين، حد يرشح شركة؟", author: "كافيه بينا", url: "https://www.facebook.com/groups/egypt.business/posts/1001", ct: "POST", status: "PROCESSED", h: 1 },
    { source: srcWeb, title: "مطعم الذوق الرفيع", body: "الأكل ممتاز بس التوصيل ساعة ونص ومفيش تطبيق — محتاجين نظام طلبات محترم", author: "مطعم الذوق الرفيع", url: "https://x.com/egyfood/status/2002", ct: "COMMENT", status: "PROCESSED", h: 3 },
    { source: srcReddit, title: "Best POS for Cairo cafes?", body: "Opening second branch in Maadi, need recommendations for POS + inventory in Egypt", author: "u/cafe_owner_eg", url: "https://reddit.com/r/EgyptBusiness/comments/2003", ct: "POST", status: "PROCESSED", h: 5 },
    { source: srcNews, title: "نمو الاستثمار في المطاعم المصرية", body: "تقارير تشير لتوسع سلاسل المطاعم المحلية وافتتاح فروع جديدة في القاهرة الجديدة والشيخ زايد", author: "أخبار الأعمال", url: "https://news.example.eg/2004", ct: "ARTICLE", status: "PROCESSED", h: 8 },
    { source: srcGoogle, title: "عيادة د. سارة لطب الأسنان", body: "عيادة 4.8 نجوم — الحجز هاتفي فقط، لا يوجد نظام حجز أونلاين — فرصة Booking", author: "Google Maps", url: "https://maps.google.com/?q=dr-sara", ct: "BUSINESS", status: "PROCESSED", h: 10 },
    { source: srcWeb, title: "توتي ستور", body: "الطلبات على الدايركت واتلخبطت مرتين الأسبوع ده، محتاجين متجر إلكتروني ضروري", author: "توتي ستور", url: "https://instagram.com/p/2005", ct: "POST", status: "PROCESSED", h: 14 },
    { source: srcWeb, title: "مكتب النخبة العقارية", body: "متابعة البيعاء ورقة وقلم — محتاجين CRM بسيط للمعاينات والعمولات", author: "النخبة العقارية", url: "https://linkedin.com/posts/2006", ct: "POST", status: "PROCESSED", h: 20 },
    { source: srcFacebook, title: "جيم فيت لايف", body: "إدارة الاشتراكات الشهرية يدوي لـ800 مشترك — لو فيه تطبيق يوفر الوقت", author: "فيت لايف", url: "https://facebook.com/groups/gymowners/posts/2007", ct: "POST", status: "DUPLICATE", h: 30 },
  ]
  for (const item of feedItems) {
    await db.contentItem.create({
      data: {
        workspaceId: wsId, sourceId: item.source.id,
        externalId: `seed-${item.url.slice(-4)}`, canonicalUrl: item.url,
        authorName: item.author, title: item.title, body: item.body,
        contentType: item.ct as never, status: item.status as never,
        publishedAt: hours(item.h), collectedAt: hours(item.h),
        language: /[\u0600-\u06FF]/.test(item.body) ? "ar" : "en",
      },
    })
  }

  // ---- Jobs ----
  await db.job.createMany({
    data: [
      { workspaceId: wsId, type: "DISCOVERY", status: "SUCCESS", payload: { ruleId: ruleCafes.id } as object, scheduledAt: hours(1), startedAt: hours(1), completedAt: hours(1), result: { message: "discovered=8 leadsCreated=2 duplicates=1" } as object, createdAt: hours(1) },
      { workspaceId: wsId, type: "DEEP_RESEARCH", status: "SUCCESS", payload: { leadId: "seed" } as object, scheduledAt: hours(2), startedAt: hours(2), completedAt: hours(2), result: { message: "research completed" } as object, createdAt: hours(2) },
      { workspaceId: wsId, type: "DISCOVERY", status: "RUNNING", priority: 70, payload: { ruleId: ruleClinics.id } as object, scheduledAt: new Date(), startedAt: new Date(), workerId: "worker-demo", createdAt: new Date() },
    ],
  })

  // ---- Saved Views ----
  await db.savedView.createMany({
    data: [
      { workspaceId: wsId, name: "HOT Leads اليوم", filters: { temperature: "HOT" } as object },
      { workspaceId: wsId, name: "لم يتم التواصل معهم", filters: { status: "NEW" } as object },
      { workspaceId: wsId, name: "فرص خرائط جوجل", filters: { source: "GOOGLE_MAPS", minScore: 60 } as object },
      { workspaceId: wsId, name: "متابعة اليوم", filters: { followUp: "today" } as object },
    ],
  })

  // ---- Tags ----
  const tagHot = await db.tag.create({ data: { workspaceId: wsId, name: "أولوية قصوى", color: "#ef4444" } })
  const tagCafe = await db.tag.create({ data: { workspaceId: wsId, name: "كافيهات", color: "#14b8a6" } })
  const cafeLead = await db.lead.findFirst({ where: { workspaceId: wsId, business: { industry: "cafe" } } })
  if (cafeLead) {
    await db.leadTag.createMany({ data: [{ leadId: cafeLead.id, tagId: tagHot.id }, { leadId: cafeLead.id, tagId: tagCafe.id }] })
  }

  // ---- Alerts ----
  await db.alert.createMany({
    data: [
      { workspaceId: wsId, type: "HOT_LEAD", title: "Lead ساخن جديد!", message: "مطعم الذوق الرفيع حقق Score 93 — جاهز للتواصل فورًا", severity: "CRITICAL", actionUrl: "/lead/xyz1", isRead: false, createdAt: hours(2) },
      { workspaceId: wsId, type: "RESEARCH", title: "اكتمل البحث العميق", message: "تم إكمال بحث كافيه بينا — 3 فرص خدمية مكتشفة", severity: "INFO", isRead: false, createdAt: hours(5) },
      { workspaceId: wsId, type: "SOURCE", title: "مصدر موقوف", message: "جروبات فيسبوك متوقفة مؤقتًا بانتظار مراجعة سياسات الوصول", severity: "WARNING", isRead: true, createdAt: days(2) },
    ],
  })

  // ---- Automation ----
  await db.automation.createMany({
    data: [
      {
        workspaceId: wsId, name: "HOT Lead → مهمة متابعة فورية",
        trigger: "LEAD_SCORE_CHANGED" as never, actionType: "CREATE_TASK" as never,
        conditions: { score_gte: 90 } as object,
        actionConfig: { title: "اتصال فوري بالـLead الساخن", due_days: 0 } as object,
      },
      {
        workspaceId: wsId, name: "بدء بحث عميق للـScore فوق 80",
        trigger: "NEW_LEAD" as never, actionType: "START_RESEARCH" as never,
        conditions: { score_gte: 80 } as object, actionConfig: { depth: "DEEP" } as object,
      },
    ],
  })

  // ---- AI Chat session ----
  const session = await db.aiChatSession.create({
    data: { workspaceId: wsId, userId: owner.id, title: "وريني الـHOT Leads" },
  })
  await db.aiChatMessage.createMany({
    data: [
      { sessionId: session.id, role: "user", content: "وريني كل الـHOT Leads ومين كلم فيهم؟", createdAt: hours(6) },
      { sessionId: session.id, role: "assistant", content: "عندك 2 HOT Leads حاليًا:\n\n1. مطعم الذوق الرفيع — Score 93 (مهتم) — تم التواصل معاه قبل يومين ✅\n2. كافيه بينا — المعادي — Score 91 (مؤهل) — لسه محدش كلمه ❌\n\nالأنسب تبدأ بكافيه بينا لأنه لسه متواصلش معاه. عايزني أعمل بحث عميق له ولا أعمل مهمة متابعة؟", toolCalls: [{ tool: "search_crm", summary: "تم العثور على 2 عميل مطابق", ok: true }] as object, createdAt: hours(6) },
      { sessionId: session.id, role: "user", content: "اعمل مهمة متابعة للكافيه بكره", createdAt: hours(6) },
      { sessionId: session.id, role: "assistant", content: "تم إنشاء مهمة \"متابعة كافيه بينا\" مستحقة بكرة — تلاقيها في شاشة المهام. تحب أجهزلك مسودة رسالة واتساب جاهزة للتواصل؟", createdAt: hours(6) },
    ],
  })

  // ---- AI Runs ----
  await db.aiRun.createMany({
    data: [
      { workspaceId: wsId, type: "CLASSIFICATION" as never, provider: "ZAI", model: "glm", inputTokens: 420, outputTokens: 90, totalTokens: 510, latencyMs: 820, createdAt: hours(1) },
      { workspaceId: wsId, type: "CLASSIFICATION" as never, provider: "HEURISTIC", model: "keywords", latencyMs: 4, createdAt: hours(1) },
      { workspaceId: wsId, type: "DEEP_RESEARCH" as never, provider: "ZAI", model: "glm", inputTokens: 2100, outputTokens: 640, totalTokens: 2740, latencyMs: 3100, createdAt: hours(2) },
      { workspaceId: wsId, type: "CHAT" as never, provider: "ZAI", model: "glm", inputTokens: 980, outputTokens: 310, totalTokens: 1290, latencyMs: 1500, createdAt: hours(6) },
      { workspaceId: wsId, type: "REVIEW_ANALYSIS" as never, provider: "ZAI", model: "glm", inputTokens: 1600, outputTokens: 280, totalTokens: 1880, latencyMs: 1900, createdAt: hours(3) },
    ],
  })

  // ---- AiProviderConfig ----
  await db.aiProviderConfig.create({
    data: { workspaceId: wsId, provider: "MISTRAL" as never, model: "mistral-small-latest", purpose: "CLASSIFICATION" as never, isDefault: true, baseUrl: "https://api.mistral.ai/v1", temperature: 0.2, maxTokens: 1600 },
  })

  const counts = {
    users: await db.user.count(), businesses: await db.business.count(), leads: await db.lead.count(),
    opportunities: await db.opportunity.count(), findings: await db.finding.count(),
    reviews: await db.review.count(), contentItems: await db.contentItem.count(),
    alerts: await db.alert.count(), tasks: await db.task.count(), notes: await db.note.count(),
  }
  console.log("Seed complete:", counts)
  console.log("Login → admin@leados.ai / 123456 (أحمد المدير)")
  console.log("Login → sara@leados.ai / 123456 (سارة)")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
