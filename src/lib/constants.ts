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
  "DIRECTORY", "OTHER",
] as const
export const SOURCE_TYPE_LABELS: Record<string, string> = {
  FACEBOOK: "فيسبوك", LINKEDIN: "لينكدإن", X: "X / تويتر", REDDIT: "ريديت",
  INSTAGRAM: "إنستجرام", TIKTOK: "تيك توك", YOUTUBE: "يوتيوب", TELEGRAM: "تليجرام",
  GOOGLE_MAPS: "خرائط جوجل", GOOGLE_SEARCH: "بحث جوجل", WEBSITE: "مواقع الويب",
  NEWS: "أخبار", RSS: "RSS", DIRECTORY: "أدلة الأعمال", OTHER: "أخرى",
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
] as const
export const JOB_STATUSES = ["QUEUED", "RUNNING", "SUCCESS", "FAILED", "RETRYING", "CANCELLED"] as const
export const JOB_STATUS_LABELS: Record<string, string> = {
  QUEUED: "في الطابور", RUNNING: "جارٍ", SUCCESS: "نجح",
  FAILED: "فشل", RETRYING: "إعادة محاولة", CANCELLED: "ملغي",
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

export const AI_PROVIDERS = ["MISTRAL", "OPENAI", "ANTHROPIC", "OLLAMA", "VLLM", "OTHER"] as const
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
