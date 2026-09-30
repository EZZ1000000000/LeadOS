// LeadOS — Enums & Constants with Arabic labels
// Mirrors the PostgreSQL schema enums (stored as Strings in SQLite)

export const LEAD_STATUSES = [
  "NEW", "QUALIFIED", "CONTACTED", "REPLIED", "INTERESTED",
  "MEETING", "PROPOSAL", "WON", "LOST", "NURTURE", "ARCHIVED",
] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "جديد", QUALIFIED: "مؤهل", CONTACTED: "تم التواصل", REPLIED: "رد عليك",
  INTERESTED: "مهتم", MEETING: "اجتماع", PROPOSAL: "عرض سعر",
  WON: "تم الإغلاق", LOST: "خسارة", NURTURE: "تنمية علاقة", ARCHIVED: "مؤرشف",
}

export const PIPELINE_ORDER: LeadStatus[] = [
  "NEW", "QUALIFIED", "CONTACTED", "REPLIED", "INTERESTED",
  "MEETING", "PROPOSAL", "WON", "LOST", "NURTURE",
]

export const LEAD_TEMPERATURES = ["HOT", "WARM", "COLD", "UNKNOWN"] as const
export const TEMPERATURE_LABELS: Record<string, string> = {
  HOT: "ساخن 🔥", WARM: "دافئ", COLD: "بارد", UNKNOWN: "غير محدد",
}

export const INTENT_LEVELS = ["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "NONE", "UNKNOWN"] as const
export const INTENT_LABELS: Record<string, string> = {
  VERY_HIGH: "نية شراء عالية جدًا", HIGH: "نية شراء عالية", MEDIUM: "نية متوسطة",
  LOW: "نية منخفضة", NONE: "لا توجد نية", UNKNOWN: "غير محدد",
}

export const SOURCE_TYPES = [
  "FACEBOOK", "LINKEDIN", "X", "REDDIT", "INSTAGRAM", "TIKTOK", "YOUTUBE",
  "TELEGRAM", "GOOGLE_MAPS", "GOOGLE_SEARCH", "WEBSITE", "NEWS", "RSS",
  "DIRECTORY", "JOBS", "MARKETPLACE", "FREELANCE", "ADS_LIBRARY", "REVIEWS",
  "EVENTS", "QUORA", "DISCORD", "OTHER",
] as const

// مصادر لوحة التحكم — المنصات كلها ظاهرة دايمًا في الفلتر (حتى اللي لسه عددها صفر)
// الترتيب: منصات الصيد الـ16 الأول ← المصادر الأساسية (ويب/خرايط) ← القديم (جروبات فيسبوك من عهد المودال)
export const DASHBOARD_SOURCES: string[] = [
  "FACEBOOK", "INSTAGRAM", "X", "LINKEDIN", "REDDIT", "TIKTOK", "YOUTUBE",
  "TELEGRAM", "DIRECTORY", "JOBS", "MARKETPLACE", "FREELANCE", "ADS_LIBRARY",
  "REVIEWS", "EVENTS", "QUORA", "DISCORD",
  "WEB", "GOOGLE_MAPS", "GOOGLE_SEARCH", "FACEBOOK_GROUPS",
]
export const SOURCE_TYPE_LABELS: Record<string, string> = {
  FACEBOOK: "فيسبوك", LINKEDIN: "لينكدإن", X: "X / تويتر", REDDIT: "ريديت",
  INSTAGRAM: "إنستجرام", TIKTOK: "تيك توك", YOUTUBE: "يوتيوب", TELEGRAM: "تليجرام",
  GOOGLE_MAPS: "خرائط جوجل", GOOGLE_SEARCH: "بحث جوجل", WEBSITE: "مواقع الويب",
  NEWS: "أخبار", RSS: "RSS", DIRECTORY: "أدلة الأعمال", OTHER: "أخرى",
  JOBS: "مواقع التوظيف", MARKETPLACE: "مواقع البيع (OLX/دوبيزل)", FREELANCE: "العمل الحر (مستقل/خمسات)",
  ADS_LIBRARY: "مكتبة إعلانات ميتا", REVIEWS: "تقييمات ومراجعات", EVENTS: "المناسبات والمعارض",
  QUORA: "Quora", DISCORD: "ديسكورد",
}

// ---- حزم النيتش الجاهزة (طلب: مسح نيتش كامل بضغطة) ----
export interface NichePack {
  key: string
  ar: string
  icon: string
  industries: string[]
  services: string[]
  keywords: string[]
  sourceTypes: string[]
}
export const NICHE_PACKS: NichePack[] = [
  {
    key: "restaurants", ar: "مطاعم وكافيهات", icon: "🍽️",
    industries: ["مطعم", "كافيه", "بيتزا", "فول وطعمية"],
    services: ["نظام طلبات أونلاين", "نظام كاشير POS", "تطبيق موبايل"],
    keywords: ["مطعم محتاج نظام طلبات", "كافيه عايز تطبيق دليفري", "مطعم مفيش موقع اونلاين"],
    sourceTypes: ["GOOGLE_MAPS", "FACEBOOK", "INSTAGRAM", "MARKETPLACE"],
  },
  {
    key: "pharmacies", ar: "صيدليات", icon: "💊",
    industries: ["صيدلية", "شركة أدوية"],
    services: ["نظام كاشير POS", "نظام ERP", "أتمتة وواتساب"],
    keywords: ["صيدلية محتاجة برنامج كاشير", "صيدليات بياعة اونلاين"],
    sourceTypes: ["GOOGLE_MAPS", "FACEBOOK", "DIRECTORY"],
  },
  {
    key: "clinics", ar: "عيادات وأطباء", icon: "🩺",
    industries: ["عيادة", "طبيب", "مركز أسنان", "معمل تحاليل"],
    services: ["نظام حجوزات", "موقع إلكتروني", "تسويق رقمي"],
    keywords: ["عيادة محتاجة نظام حجز مواعيد", "دكتور عايز موقع تعريفى"],
    sourceTypes: ["GOOGLE_MAPS", "FACEBOOK", "REVIEWS"],
  },
  {
    key: "gyms", ar: "جيمات وناديي", icon: "🏋️",
    industries: ["جيم", "نادي", "كروس فيت", "يوغا"],
    services: ["نظام اشتراكات", "تطبيق موبايل", "تسويق رقمي"],
    keywords: ["جيم محتاج نظام اشتراكات", "نادي عايز تطبيق حجز"],
    sourceTypes: ["GOOGLE_MAPS", "INSTAGRAM", "FACEBOOK"],
  },
  {
    key: "factories", ar: "مصانع", icon: "🏭",
    industries: ["مصنع", "شركة تصنيع", "مستلزمات صناعية"],
    services: ["نظام ERP", "نظام CRM", "حلول سحابية"],
    keywords: ["مصنع محتاج نظام ERP", "شركة تصنيع عايزة نظام مخازن"],
    sourceTypes: ["GOOGLE_SEARCH", "DIRECTORY", "LINKEDIN", "JOBS"],
  },
  {
    key: "ecommerce", ar: "براندات إلكترونية", icon: "🛒",
    industries: ["متجر إلكتروني", "براند", "بيع اونلاين"],
    services: ["متجر إلكتروني", "تسويق رقمي", "أتمتة وواتساب"],
    keywords: ["براند عايز متجر الكتروني", "بياعة اونلاين محتاجة موقع", "صفحة بيع منتجات محتاجة شيبينج نظام"],
    sourceTypes: ["INSTAGRAM", "FACEBOOK", "TIKTOK", "MARKETPLACE"],
  },
  {
    key: "real_estate", ar: "عقارات", icon: "🏢",
    industries: ["عقارات", "مكتب عقاري", "كمبوند"],
    services: ["موقع إلكتروني", "نظام CRM", "تسويق رقمي"],
    keywords: ["مكتب عقارات محتاج موقع", "سمسار عقارى عايز CRM"],
    sourceTypes: ["GOOGLE_MAPS", "FACEBOOK", "MARKETPLACE"],
  },
  {
    key: "education", ar: "تعليم ودروس", icon: "🎓",
    industries: ["سنتر دروس", "مدرسة خاصة", "كورسات"],
    services: ["نظام حجوزات", "موقع إلكتروني", "تطبيق موبايل"],
    keywords: ["سنتر محتاج نظام حجز حصص", "معلم عايز منصة كورسات"],
    sourceTypes: ["GOOGLE_MAPS", "FACEBOOK", "YOUTUBE"],
  },
  {
    key: "salons", ar: "صالونات وسبا", icon: "💅",
    industries: ["صالون تجميل", "سبا", "بربير شوب"],
    services: ["نظام حجوزات", "موقع إلكتروني", "تسويق رقمي"],
    keywords: ["صالون محتاج نظام حجز مواعيد", "سبا عايز تطبيق حجز"],
    sourceTypes: ["GOOGLE_MAPS", "INSTAGRAM", "FACEBOOK"],
  },
  {
    key: "startups", ar: "ستارت أب وشركات صغيرة", icon: "🚀",
    industries: ["ستارت أب", "شركة ناشئة", "شركة برمجيات"],
    services: ["نظام CRM", "أتمتة وواتساب", "تكاملات أنظمة"],
    keywords: ["ستارت اب مصري بيدور على مطور", "شركة ناشئة محتاجة اتوميشن"],
    sourceTypes: ["LINKEDIN", "JOBS", "FREELANCE", "QUORA"],
  },
]

// ---- التوسيع الجغرافي: محافظات مصر (طلب: مسح محافظة بمحافظة) ----
export const EGYPT_GOVERNORATES = [
  "القاهرة", "الجيزة", "الإسكندرية", "القليوبية", "الدقهلية", "الشرقية",
  "المنوفية", "الغربية", "بني سويف", "الفيوم", "المنيا", "أسيوط",
  "سوهاج", "قنا", "الأقصر", "أسوان", "البحر الأحمر", "الوادي الجديد",
  "مطروح", "شمال سيناء", "جنوب سيناء", "الإسماعيلية", "بورسعيد",
  "السويس", "دمياط", "كفر الشيخ", "البحيرة",
] as const

// ---- التقويم الموسمي المصري (طلب: استغلال الموسمية قبل المنافسين) ----
// seasonFor(month1based) → { key, ar, boost } — boost تتحط في استعلامات الاكتشاف
export interface SeasonInfo { key: string; ar: string; boost: string[] }
export function seasonFor(month1based: number): SeasonInfo {
  if ([6, 7, 8].includes(month1based))
    return { key: "summer", ar: "الصيف والعزل المدرسي", boost: ["صيفي", "رحلات ساحل", "عزومات", "مشاوير"] }
  if (month1based === 3 || month1based === 4)
    return { key: "ramadan_window", ar: "موسم رمضان والمطاعم", boost: ["رمضان", "إفطار", "سحور", "طلبات رمضان"] }
  if ([9, 10].includes(month1based))
    return { key: "back_to_school", ar: "العودة للمدارس", boost: ["مدارس", "مراكز دروس", "قرطاسية"] }
  if (month1based === 11 || month1based === 12)
    return { key: "white_friday", ar: "الجمعة البيضاء والعروض", boost: ["عروض", "خصومات", "بلاك فرايداي", "تخفيضات"] }
  if ([1, 2].includes(month1based))
    return { key: "new_year", ar: "خطط السنة الجديدة", boost: ["مشروع جديد", "افتتاح", "توسع"] }
  return { key: "default", ar: "الموسم العام", boost: [] }
}

export const SOURCE_STATUSES = ["ACTIVE", "PAUSED", "ERROR", "DISABLED"] as const
export const SOURCE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "يعمل", PAUSED: "موقوف مؤقتًا", ERROR: "به خطأ", DISABLED: "معطل",
}

export const CONTENT_TYPES = [
  "POST", "COMMENT", "PROFILE", "PAGE", "REVIEW", "VIDEO", "ARTICLE",
  "BUSINESS", "WEBSITE_PAGE", "SEARCH_RESULT", "OTHER",
] as const
export const CONTENT_TYPE_LABELS: Record<string, string> = {
  POST: "منشور", COMMENT: "تعليق", PROFILE: "حساب", PAGE: "صفحة",
  REVIEW: "مراجعة", VIDEO: "فيديو", ARTICLE: "مقال", BUSINESS: "نشاط تجاري",
  WEBSITE_PAGE: "صفحة موقع", SEARCH_RESULT: "نتيجة بحث", OTHER: "أخرى",
}

export const CONTENT_STATUSES = ["NEW", "QUEUED", "PROCESSED", "IGNORED", "FAILED", "DUPLICATE"] as const
export const LEAD_SOURCE_TYPES = [
  "DISCOVERY", "GOOGLE_MAPS", "REFERRAL", "IMPORT", "MANUAL", "WEBSITE", "SOCIAL", "OTHER",
] as const
export const LEAD_SOURCE_TYPE_LABELS: Record<string, string> = {
  DISCOVERY: "اكتشاف آلي", GOOGLE_MAPS: "خرائط جوجل", REFERRAL: "ترشيح",
  IMPORT: "استيراد", MANUAL: "إدخال يدوي", WEBSITE: "موقع إلكتروني",
  SOCIAL: "سوشيال ميديا", OTHER: "أخرى",
}

/** إشارات النية — أولوية الصياد: صاحب الحاجة الصريحة أولًا، بعدين اللي بيقارن بالمنافسين */
export const INTENT_SIGNALS = ["EXPLICIT_NEED", "COMPETITOR_ENGAGER", "AD_SPENDER", "MARKET_LIST"] as const
export const INTENT_SIGNAL_LABELS: Record<string, string> = {
  EXPLICIT_NEED: "🔥 صاحب حاجة صريحة",
  COMPETITOR_ENGAGER: "⚔️ بيقارن بالمنافسين",
  AD_SPENDER: "💰 بيصرف إعلانات",
  MARKET_LIST: "📋 قائمة السوق",
}

export const CONFIDENCE_LEVELS = ["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "UNKNOWN"] as const
export const CONFIDENCE_LABELS: Record<string, string> = {
  VERY_HIGH: "عالية جدًا", HIGH: "عالية", MEDIUM: "متوسطة", LOW: "منخفضة", UNKNOWN: "غير محددة",
}

export const RESEARCH_DEPTHS = ["QUICK", "DEEP", "ULTRA_DEEP"] as const
export const RESEARCH_DEPTH_LABELS: Record<string, string> = {
  QUICK: "سريع", DEEP: "عميق", ULTRA_DEEP: "عميق جدًا",
}

export const RESEARCH_STATUSES = ["PENDING", "QUEUED", "RUNNING", "COMPLETED", "PARTIAL", "FAILED", "CANCELLED"] as const
export const RESEARCH_STATUS_LABELS: Record<string, string> = {
  PENDING: "بالانتظار", QUEUED: "في الطابور", RUNNING: "جارٍ التنفيذ",
  COMPLETED: "مكتمل", PARTIAL: "مكتمل جزئيًا", FAILED: "فشل", CANCELLED: "ملغي",
}

export const FINDING_TYPES = ["FACT", "INFERENCE", "OPPORTUNITY", "RISK", "RECOMMENDATION", "SIGNAL"] as const
export const FINDING_TYPE_LABELS: Record<string, string> = {
  FACT: "حقيقة", INFERENCE: "استنتاج", OPPORTUNITY: "فرصة",
  RISK: "خطر", RECOMMENDATION: "توصية", SIGNAL: "إشارة",
}

export const OPPORTUNITY_STATUSES = ["OPEN", "QUALIFIED", "PROPOSED", "WON", "LOST", "DISMISSED"] as const
export const OPPORTUNITY_STATUS_LABELS: Record<string, string> = {
  OPEN: "مفتوحة", QUALIFIED: "مؤهلة", PROPOSED: "تم عرضها",
  WON: "مكسبة", LOST: "مفقودة", DISMISSED: "مستبعدة",
}

export const INTERACTION_TYPES = [
  "NOTE", "CALL", "EMAIL", "WHATSAPP", "MESSAGE", "COMMENT",
  "MEETING", "TASK", "STATUS_CHANGE", "SYSTEM", "AI_ACTION",
] as const
export const INTERACTION_TYPE_LABELS: Record<string, string> = {
  NOTE: "ملاحظة", CALL: "مكالمة", EMAIL: "إيميل", WHATSAPP: "واتساب",
  MESSAGE: "رسالة", COMMENT: "تعليق", MEETING: "اجتماع", TASK: "مهمة",
  STATUS_CHANGE: "تغيير حالة", SYSTEM: "النظام", AI_ACTION: "إجراء AI",
}

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"] as const
export const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: "للتنفيذ", IN_PROGRESS: "جارية", DONE: "منجزة", CANCELLED: "ملغاة",
}

export const JOB_TYPES = [
  "DISCOVERY", "SOURCE_SYNC", "CONTENT_PROCESSING", "LEAD_QUALIFICATION",
  "DEEP_RESEARCH", "ENRICHMENT", "WEBSITE_CRAWL", "GOOGLE_MAPS_SYNC",
  "REVIEW_ANALYSIS", "EMBEDDING", "ALERT", "AUTOMATION", "REPORT", "CLEANUP",
  "REACTIVATION", "SOURCE_EVALUATION",
] as const
// WAITING_FOR_CAPABILITY: مهمة متوقفة مؤقتًا لغياب جلسة/قدرة — ليست فشلًا، وبتترجع للطابور تلقائيًا عند توفر الجلسة
export const JOB_STATUSES = ["QUEUED", "RUNNING", "SUCCESS", "FAILED", "RETRYING", "CANCELLED", "WAITING_FOR_CAPABILITY"] as const
export const JOB_STATUS_LABELS: Record<string, string> = {
  QUEUED: "في الطابور", RUNNING: "جارٍ", SUCCESS: "نجح",
  FAILED: "فشل", RETRYING: "إعادة محاولة", CANCELLED: "ملغي",
  WAITING_FOR_CAPABILITY: "منتظر قدرة/جلسة",
}

// ---- SESSIONLESS MODE: حالات حسابات/جلسات المنصات + أوضاع التشغيل ----
export const PLATFORM_ACCOUNT_STATUSES = [
  "NOT_CONFIGURED", "READY", "WARMING", "EXPIRED", "NEEDS_SESSION", "BLOCKED", "ERROR", "PAUSED",
  "ACTIVE", "COOLDOWN", "DISABLED",
] as const
export const PLATFORM_ACCOUNT_STATUS_LABELS: Record<string, string> = {
  NOT_CONFIGURED: "غير مضبوط", READY: "جاهز", WARMING: "في فترة التهيئة", EXPIRED: "انتهى",
  NEEDS_SESSION: "محتاج جلسة", BLOCKED: "محجوب", ERROR: "به خطأ", PAUSED: "موقوف",
  ACTIVE: "نشط", COOLDOWN: "تبريد", DISABLED: "معطل",
}
export const RUNTIME_MODES = ["FULL", "SESSIONLESS", "DEGRADED", "STOPPED"] as const
export const RUNTIME_MODE_LABELS: Record<string, string> = {
  FULL: "تشغيل كامل (جلسات + عام)", SESSIONLESS: "بدون جلسات (المسارات العامة)",
  DEGRADED: "متدهور (بعض الجلسات معطوبة)", STOPPED: "موقوف",
}

export const RULE_ACTION_TYPES = [
  "INCLUDE", "EXCLUDE", "SCORE_BOOST", "SCORE_PENALTY", "ASSIGN",
  "START_RESEARCH", "CREATE_TASK", "SEND_ALERT", "AUTO_TAG", "CHANGE_STATUS",
] as const
export const RULE_ACTION_LABELS: Record<string, string> = {
  INCLUDE: "تضمين", EXCLUDE: "استثناء", SCORE_BOOST: "رفع Score",
  SCORE_PENALTY: "خصم Score", ASSIGN: "تعيين مسؤول", START_RESEARCH: "بدء بحث عميق",
  CREATE_TASK: "إنشاء مهمة", SEND_ALERT: "إرسال تنبيه", AUTO_TAG: "وسم تلقائي",
  CHANGE_STATUS: "تغيير حالة",
}

export const AUTOMATION_TRIGGERS = [
  "NEW_LEAD", "LEAD_SCORE_CHANGED", "RESEARCH_COMPLETED", "INTENT_DETECTED",
  "STATUS_CHANGED", "NEW_SIGNAL", "TASK_DUE", "SCHEDULE", "MANUAL",
] as const
export const AUTOMATION_ACTION_TYPES = [
  "CREATE_TASK", "SEND_NOTIFICATION", "ADD_TAG", "CHANGE_STATUS",
  "ASSIGN_USER", "START_RESEARCH", "GENERATE_REPLY", "WEBHOOK",
] as const

export const AI_PROVIDERS = ["NVIDIA", "OTHER"] as const
export const AI_RUN_TYPES = [
  "CLASSIFICATION", "EXTRACTION", "SUMMARIZATION", "DEEP_RESEARCH", "EMBEDDING",
  "CHAT", "LEAD_SCORING", "REPLY_DRAFT", "WEBSITE_ANALYSIS", "REVIEW_ANALYSIS",
  "QUERY_PLANNING", "DEDUPLICATION", "OTHER",
] as const

export const USER_ROLES = ["OWNER", "ADMIN", "MANAGER", "AGENT", "VIEWER"] as const
export const USER_ROLE_LABELS: Record<string, string> = {
  OWNER: "مالك", ADMIN: "مدير النظام", MANAGER: "مدير", AGENT: "مندوب مبيعات", VIEWER: "مشاهد",
}

export const WORKSPACE_ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const

// ---- اللوحتين (Panel Segments) ----
export const SEGMENTS = ["CARDS", "AGENCY", "BOTH"] as const
export type SegmentValue = (typeof SEGMENTS)[number]
export const SEGMENT_LABELS: Record<string, string> = {
  CARDS: "نظام الكروت",
  AGENCY: "الأجنسي",
  BOTH: "اللوحتين",
}

export const GROUP_PLATFORMS = ["FACEBOOK", "TELEGRAM", "REDDIT", "X"] as const
export const GROUP_PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: "فيسبوك", TELEGRAM: "تليجرام", REDDIT: "ريديت", X: "X / تويتر", OTHER: "أخرى",
}

export const GROUP_STATUSES = ["ACTIVE", "PAUSED", "NEEDS_SESSION", "BLOCKED", "ARCHIVED"] as const
export const GROUP_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "يعمل", PAUSED: "موقوف", NEEDS_SESSION: "محتاج جلسة",
  BLOCKED: "محجوب", ARCHIVED: "مؤرشف",
}

export const POST_STATUSES = ["NEW", "QUALIFIED", "REJECTED", "CONVERTED"] as const
export const POST_STATUS_LABELS: Record<string, string> = {
  NEW: "جديد", QUALIFIED: "مؤهل", REJECTED: "مرفوض", CONVERTED: "محوّل لعميل",
}

// ---- Lead Scoring thresholds (per doc §14) ----
export function temperatureFromScore(score: number): string {
  if (score >= 90) return "HOT"
  if (score >= 75) return "WARM"
  if (score >= 50) return "COLD"
  return "COLD"
}

export const SCORE_WEIGHTS = {
  intent: 30,
  businessFit: 20,
  decisionMaker: 15,
  urgency: 10,
  recentActivity: 10,
  contactability: 5,
  opportunityStrength: 10,
} as const

export const SERVICE_CATALOG = [
  { key: "website", ar: "موقع إلكتروني" },
  { key: "mobile_app", ar: "تطبيق موبايل" },
  { key: "pos", ar: "نظام كاشير POS" },
  { key: "crm", ar: "نظام CRM" },
  { key: "erp", ar: "نظام ERP" },
  { key: "ecommerce", ar: "متجر إلكتروني" },
  { key: "booking", ar: "نظام حجوزات" },
  { key: "ordering", ar: "نظام طلبات أونلاين" },
  { key: "marketing", ar: "تسويق رقمي" },
  { key: "automation", ar: "أتمتة وواتساب" },
  { key: "seo", ar: "تحسين ظهور SEO" },
  { key: "branding", ar: "هوية وبزنس براندينج" },
  { key: "cloud", ar: "حلول سحابية" },
  { key: "integrations", ar: "تكاملات أنظمة" },
] as const

export const INDUSTRY_CATALOG = [
  { key: "cafe", ar: "كافيه" },
  { key: "restaurant", ar: "مطعم" },
  { key: "clinic", ar: "عيادة" },
  { key: "retail", ar: "متجر تجزئة" },
  { key: "gym", ar: "جيم" },
  { key: "salon", ar: "صالون تجميل" },
  { key: "pharmacy", ar: "صيدلية" },
  { key: "real_estate", ar: "عقارات" },
  { key: "law_firm", ar: "مكتب محاماة" },
  { key: "ecommerce_brand", ar: "براند إلكتروني" },
  { key: "factory", ar: "مصنع" },
  { key: "education", ar: "تعليم ودروس" },
] as const

export function serviceAr(key: string): string {
  return SERVICE_CATALOG.find((s) => s.key === key)?.ar ?? key
}
export function industryAr(key: string): string {
  return INDUSTRY_CATALOG.find((s) => s.key === key)?.ar ?? key
}

// ---- helpers for Json arrays ----
export function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String)
  if (typeof v === "string" && v.startsWith("[")) {
    try { return JSON.parse(v).map(String) } catch { return [] }
  }
  return []
}
