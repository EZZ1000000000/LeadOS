// LeadOS — Panel Segments + Post Classification (تحدي الجروبات)
// اللوحتين: CARDS (نظام كروت النت للكافيهات) و AGENCY (التسويق/الميديا بينج/البرمجة)
// كل بوست أو عميل بيتصنف لواحدة من: CARDS | AGENCY | BOTH
// قاعدة المستخدم: الكافيه لا يظهر في لوحة الأجنسي إلا لو محتاج خدمة أجنسي.

export type Segment = "CARDS" | "AGENCY" | "BOTH"

// ---------- كلمات منتج الكروت (نظام كروت النت للمقاهي) ----------
const CARDS_PRODUCT_WORDS = [
  "كروت نت", "كروت انترنت", "كروت النت", "كارت نت", "كروت واي فاي", "كروت واى فاي",
  "كارت واي فاي", "سستم كروت", "نظام كروت", "سيستم كروت", "كروت ساعه", "كروت ساعة",
  "نت للمقاهي", "انترنت للمقاهي", "نت للكافيهات", "انترنت للكافيهات",
  "hotspot", "hot spot", "voucher", "wifi cards", "captive portal", "mikrotik", "ميكروتك",
]

// ---------- كلمات الكافيهات (الجمهور المستهدف للكروت) ----------
const CAFE_WORDS = [
  "كافيه", "كافي", "قهوة", "قهوه", "كوفي", "مقهى", "مقاهي", "كافيهات",
  "coffee", "cafe", "caf\u00e9", "espresso", "specialty coffee",
]

// ---------- كلمات خدمات الأجنسي ----------
const AGENCY_SERVICE_WORDS = [
  "تسويق", "تسويق الكتروني", "تسويق إلكتروني", "دعاية", "إعلانات", "اعلانات",
  "إعلان", "اعلان", "إعلان ممول", "اعلان ممول", "ممول", "بوست ممول", "حملة",
  "ميديا بينج", "media buying", "ads", "adwords", "جوجل ادز", "google ads",
  "سوشيال ميديا", "social media", "ادارة صفحات", "إدارة صفحات", "كونتنت", "محتوى",
  "تصوير", "فوتو شوت", "photoshoot", "تصوير منتجات", "فوتوجرافر", "مصور",
  "فيديو", "مونتاج", "ريلز", "reels", "موشن", "motion",
  "تصميم", "لوجو", "شعار", "هوية", "براندنج", "branding", "logo",
  "موقع", "ويب سايت", "website", "تطبيق", "app", "سيو", "seo", "برمجة",
  "متجر الكتروني", "متجر إلكتروني", "ecommerce", "كاشير", "pos", "crm",
  "منيو الكتروني", "منيو رقمي", "qr menu",
]

// ---------- كلمات النية الشرائية ----------
const INTENT_WORDS = [
  "محتاج", "محتاجين", "عايز", "عايزين", "عاوز", "عاوزين", "مطلوب", "مطلوبين",
  "أبحث عن", "ببحث عن", "ادور على", "بدور على", "دور على", "حد يعرف",
  "حد يرشح", "ترشيح", "يقترح", "اقتراحات", "ناقصني",
  "بكام", "التكلفة", "عرض سعر", "التقدير",
  "need", "looking for", "recommend", "suggestion", "anyone know", "quote",
]

// كلمات ملمح للميزانية/الاتصال
const BUDGET_WORDS = ["بكام", "سعر", "تكلفة", "ميزانية", "عرض سعر", "price", "budget"]
const CONTACT_RE = /(\+?20)?\s?1[0125]\d{8}|\bwhatsapp\b|\bواتساب\b|تواصل\s*(معا?ي)?|ابعت\s*(لي)?|كلمني/

const normalize = (t: string) => t.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
const uniq = <T,>(a: T[]): T[] => [...new Set(a)]

function hitWords(text: string, words: string[]): string[] {
  const n = normalize(text)
  return words.filter((w) => n.includes(normalize(w)))
}

/** هل النص تابع لكافيه/مقهى؟ */
export function isCafeText(text: string): boolean {
  return hitWords(text, CAFE_WORDS).length > 0
}

export interface PostClassification {
  score: number // 0-99 قوة النية
  segment: Segment
  matchedKeywords: string[]
  hasIntent: boolean
  isCafe: boolean
}

/** تصنيف بوست جروب: أي لوحة؟ ونيته قوية قد إيه؟ */
export function classifyPost(content: string, extraHint?: string): PostClassification {
  const text = `${content} ${extraHint ?? ""}`
  const cardsHits = hitWords(text, CARDS_PRODUCT_WORDS)
  const agencyHits = hitWords(text, AGENCY_SERVICE_WORDS)
  const intentHits = hitWords(text, INTENT_WORDS)
  const budgetHits = hitWords(text, BUDGET_WORDS)
  const cafe = isCafeText(text)
  const hasContact = CONTACT_RE.test(text)

  // منطق اللوحتين:
  // - الكافيه اللي بيطلب كاشير مع الكروت = باكدج كروت واحدة → CARDS (مش أجنسي)
  // - كافيه محتاج خدمة أجنسي (تسويق/تصوير/تطبيق) → BOTH
  // - الكروت أولوية: أي طلب كروت صريح → CARDS على الأقل
  const cardsNeeds = cardsHits.length > 0
  const cafeAgencyHits = cafe
    ? agencyHits.filter((w) => !["كاشير", "pos", "نقاط بيع"].includes(normalize(w)))
    : agencyHits
  const agencyNeeds = cafeAgencyHits.length > 0

  let segment: Segment
  if (cardsNeeds && agencyNeeds) segment = "BOTH"
  else if (cardsNeeds) segment = "CARDS"
  else if (agencyNeeds && cafe) segment = "BOTH"
  else if (agencyNeeds) segment = "AGENCY"
  else if (cafe) segment = "CARDS" // كافيه بيكلم = عميل كروت محتمل حتى من غير كلمة "كروت"
  else segment = "AGENCY"

  const hasIntent = intentHits.length > 0
  let score = 15
  if (hasIntent) score += 25
  if (budgetHits.length) score += 10
  score += Math.min(36, (cardsHits.length + agencyHits.length) * 12)
  if (cafe && segment !== "AGENCY") score += 10
  if (hasContact) score += 8
  if (segment === "BOTH") score += 5

  return {
    score: Math.max(0, Math.min(99, score)),
    segment,
    matchedKeywords: uniq([...cardsHits, ...agencyHits, ...intentHits].slice(0, 10)),
    hasIntent,
    isCafe: cafe,
  }
}

// ---------- خدمات الأجنسي القابلة للاكتشاف في النص ----------
const SERVICE_DETECTORS: Array<[RegExp, string]> = [
  [/موقع|ويب سايت|website/i, "website"],
  [/تطبيق|موبايل app|\bapp\b|mobile/i, "mobile_app"],
  [/كاشير|\bpos\b|نقاط بيع/i, "pos"],
  [/crm|اداره عملاء|إدارة عملاء/i, "crm"],
  [/متجر الكتروني|متجر إلكتروني|ecommerce|اونلاين ستور/i, "ecommerce"],
  [/حجز|booking|reservation/i, "booking"],
  [/طلبات اونلاين|طلبات أونلاين|ordering|دليفري/i, "ordering"],
  [/تسويق|marketing|إعلان|اعلان|ميديا بينج|media buying|حملة/i, "marketing"],
  [/واتساب|whatsapp|أتمتة|اتمتة|automation/i, "automation"],
  [/seo|ظهور جوجل/i, "seo"],
  [/هوية|لوجو|شعار|براندنج|branding|logo/i, "branding"],
]

/** اكتشاف مفاتيح الخدمات من نص البوست (لتحويله لعميل) */
export function detectServiceKeys(text: string): string[] {
  return SERVICE_DETECTORS.filter(([re]) => re.test(text)).map(([, key]) => key)
}

// ---------- تصنيف عميل/بيزنس (للـBackfill والتحويل) ----------
const AGENCY_SERVICE_KEYS = new Set([
  "website", "mobile_app", "pos", "crm", "erp", "ecommerce", "booking",
  "ordering", "marketing", "automation", "seo", "branding", "cloud", "integrations",
])

export function asServiceKeys(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String)
  if (typeof v === "string" && v.startsWith("[")) {
    try { return (JSON.parse(v) as unknown[]).map(String) } catch { return [] }
  }
  return []
}

/**
 * تصنيف عميل قائم:
 * - كافيه بدون احتياجات أجنسي → CARDS
 * - كافيه محتاج أي خدمة أجنسي → BOTH (يظهر في اللوحتين)
 * - أي نشاط غير كافيه → AGENCY
 */
export function classifyBusinessSegment(b: {
  name?: string | null
  category?: string | null
  industry?: string | null
  summary?: string | null
  serviceNeeds?: unknown
}): Segment {
  const identity = `${b.name ?? ""} ${b.category ?? ""} ${b.industry ?? ""} ${b.summary?.slice(0, 200) ?? ""}`
  const cafe = isCafeText(identity)
  const needs = asServiceKeys(b.serviceNeeds).filter((k) => AGENCY_SERVICE_KEYS.has(k))
  if (cafe && needs.length) return "BOTH"
  if (cafe) return "CARDS"
  return "AGENCY"
}

/** فلتر SQL حسب اللوحة النشطة */
export function segmentFilter(panel: string | null | undefined): { in: string[] } | undefined {
  if (panel === "CARDS") return { in: ["CARDS", "BOTH"] }
  if (panel === "AGENCY") return { in: ["AGENCY", "BOTH"] }
  return undefined
}

/** تقييم اسم جروب مكتشف — مدى ملاءمته كمنجم ليدز لنا */
export function scoreGroupName(name: string): number {
  const agencyHits = hitWords(name, AGENCY_SERVICE_WORDS)
  const cardsHits = hitWords(name, CARDS_PRODUCT_WORDS)
  const cafe = isCafeText(name)
  const generic = hitWords(name, ["اعلن", "بيع", "شراء", "سوق", "متجر", "عقار", "وظائف", "خمات", "خدمات"])
  let s = 20
  if (cafe) s += 30
  if (cardsHits.length) s += 25
  if (agencyHits.length) s += 20
  s += Math.min(15, generic.length * 8)
  return Math.max(0, Math.min(99, s))
}

export { CAFE_WORDS, CARDS_PRODUCT_WORDS, AGENCY_SERVICE_WORDS, INTENT_WORDS }
