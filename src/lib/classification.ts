// LeadOS — AI Classification + Heuristic fallback (doc §12, §35 Layer 1/2)
import { aiChatJson } from "@/lib/ai"
import { asArray } from "@/lib/constants"

export interface LeadClassification {
  is_lead: boolean
  lead_type: "inbound_request" | "opportunity_signal" | "not_lead"
  services: string[]
  business_type: string
  intent: "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW" | "NONE"
  score: number
  urgency: "high" | "medium" | "low"
  reason: string
  language: string
}

const VALID_SERVICES = new Set([
  "website", "mobile_app", "pos", "crm", "erp", "ecommerce", "booking",
  "ordering", "marketing", "automation", "seo", "branding", "cloud", "integrations", "wifi_cards",
])

// Layer 1 — cheap keyword filtering (no AI cost)
const INTENT_KEYWORDS_AR = [
  "محتاج", "محتاجين", "عايز", "عاوز", "أبحث عن", "ببحث عن", "دور على", "أدور على",
  "ناقصني", "عايزين", "مطلوب", "أهمhalle", "ترشيح", "يقترح",
  "بتوظف", "توظف", "بدور على", "نبحث عن", "مطلوبين",
  "افتتاح", "تفتتح", "افتتح", "توسع", "توسعات", "فرع جديد", "فروع جديدة", "استثمار", "استثمرت",
]
const INTENT_KEYWORDS_EN = [
  "looking for", "need a", "need to", "we need", "searching for", "recommend",
  "any suggestions", "who can build", "hire", "rfp", "quote for",
]
const SYSTEM_WORDS = ["برنامج", "سيستم", "نظام", "تطبيق", "موقع", "app", "application", "system", "software", "website", "crm", "pos", "erp", "برمجة", "مبرمج", "شركة برمجيات", "developer", "agency", "كروت النت", "كروت نت", "نظام كروت", "واي فاي", "wifi", "hotspot", "انترنت"]
const INDUSTRY_HINTS: Array<[RegExp, string]> = [
  [/كافيه|قهوة|coffee|cafe/i, "cafe"],
  [/مطعم|مطاعم|restaurant|food/i, "restaurant"],
  [/عياد|دكتو?ر|doctor|clinic|طبيب|dentist/i, "clinic"],
  [/متجر|سوبر|retail|shop|store/i, "retail"],
  [/جيم|نادي|gym|fitness/i, "gym"],
  [/صالون|حلاق|salon|barber/i, "salon"],
  [/صيدلي|pharmacy/i, "pharmacy"],
  [/عقار|real estate/i, "real_estate"],
  [/محامي|محاماة|law|legal/i, "law_firm"],
  [/مصنع|factory/i, "factory"],
]

function detectIndustries(text: string): string {
  for (const [re, key] of INDUSTRY_HINTS) if (re.test(text)) return key
  return ""
}

function detectServices(text: string): string[] {
  const t = text.toLowerCase()
  const found: string[] = []
  const map: Array<[RegExp, string]> = [
    [/موقع|website|ويب/, "website"],
    [/تطبيق|app\b|mobile|موبايل/, "mobile_app"],
    [/\bpos\b|كاشير|نقاط بيع/, "pos"],
    [/crm|إدارة عملاء|ادارة عملاء/, "crm"],
    [/erp/, "erp"],
    [/متجر إلكتروني|ecommerce|e-commerce|أونلاين ستور/, "ecommerce"],
    [/حجز|booking|reservation/, "booking"],
    [/طلبات|ordering|delivery app|دليفري/, "ordering"],
    [/تسويق|marketing|إعلانات|ads/, "marketing"],
    [/واتساب|whatsapp|أتمتة|automation/, "automation"],
    [/seo|ظهور جوجل/, "seo"],
    [/هوية|logo|براندينج|branding/, "branding"],
    [/كروت نت|كروت النت|نظام كروت|كروت واي فاي|واي فاي|wifi|hotspot/, "wifi_cards"],
  ]
  for (const [re, key] of map) if (re.test(t)) found.push(key)
  return found
}

export function heuristicClassify(title: string | null, body: string | null, businessHint?: string): LeadClassification {
  const text = `${title ?? ""} ${body ?? ""}`.trim()
  const lower = text.toLowerCase()
  const hasArabic = /[\u0600-\u06FF]/.test(text)

  const industry = detectIndustries(`${text} ${businessHint ?? ""}`)
  const services = detectServices(text).filter((s) => VALID_SERVICES.has(s))
  const hasIntentWord = [...INTENT_KEYWORDS_AR, ...INTENT_KEYWORDS_EN].some((k) => lower.includes(k.toLowerCase()))
  const hasSystemWord = SYSTEM_WORDS.some((k) => lower.includes(k.toLowerCase()))

  let intent: LeadClassification["intent"] = "NONE"
  let score = 20
  if (hasIntentWord && hasSystemWord) {
    intent = "VERY_HIGH"
    score = 90 + Math.min(8, services.length * 2)
  } else if (hasIntentWord) {
    intent = "MEDIUM"
    score = 55
  } else if (hasSystemWord) {
    intent = "LOW"
    score = 45
  }
  const isLead = intent === "VERY_HIGH" || intent === "MEDIUM" || (services.length > 0 && Boolean(industry))
  return {
    is_lead: isLead,
    lead_type: intent === "VERY_HIGH" ? "inbound_request" : isLead ? "opportunity_signal" : "not_lead",
    services: isLead ? (services.length ? services : ["website"]) : [],
    business_type: industry,
    intent: isLead ? intent : "NONE",
    score: Math.min(99, score),
    urgency: intent === "VERY_HIGH" ? "high" : intent === "MEDIUM" ? "medium" : "low",
    reason: hasIntentWord && hasSystemWord
      ? "طلب صريح لخدمة تقنية داخل النص (تحليل كلمات مفتاحية)"
      : isLead
        ? "إشارات غير مباشرة لاحتياج محتمل (تحليل كلمات مفتاحية)"
        : "لا توجد إشارات كافية على نية شراء",
    language: hasArabic ? "ar" : "en",
  }
}

// Layer 2 — AI classification with JSON contract (doc §40)
export async function classifyContent(
  workspaceId: string,
  title: string | null,
  body: string | null,
  businessHint?: string,
  leadId?: string,
): Promise<{ classification: LeadClassification; engine: "ai" | "heuristic" }> {
  const heuristic = heuristicClassify(title, body, businessHint)
  const text = `${title ? `العنوان: ${title}\n` : ""}${body ? `النص: ${body.slice(0, 1200)}` : ""}${businessHint ? `\nسياق النشاط: ${businessHint}` : ""}`
  const result = await aiChatJson<LeadClassification>(
    [
      {
        role: "system",
        content:
          `أنت مصنف Leads داخل منصة LeadOS. حلل النص وحدد إن كان صاحبه عميل محتمل (lead) لوكالة برمجية/تسويقية مصرية. ` +
          `الخدمات المعروضة بتشمل: مواقع وتطبيقات وتسويق رقمي وفوتوشوت/تصوير احترافي، وكمان نظام كروت النت/الواي فاي للكافيهات والمطاعم. ` +
          `القاعدة الذهبية (مهمة جدًا): أي بيزنس/محل/تاجر/براند مصري ناشط تجاريًا في المنشور — بيبيع، بيستورد، بيوزع، بيفتح فرع، بيعرض أصوله (كافيه/مطعم/محل للبيع)، بيوظف، بيعلن عن عروض لتجار تانيين — ` +
          `ده lead صحيح: is_lead=true، lead_type=opportunity_signal، score بين 45-60. متضيعش صيادين بسبب صرامة زايدة. ` +
          `ارفض بس: (1) اللي بيبيع هو نفسه الخدمة اللي بنبيعها (مبرمجين/مسوقين/مصممين/وكالات بتقدم خدماتها) (2) أخبار وأبحاث وأسعار عملات (3) الناس اللي بتراجع بيزنس تاني مش صاحب البيزنس (4) محتوى عام من غير بيزنس محدد. ` +
          `ارجع JSON فقط بالشكل: {"is_lead":bool,"lead_type":"inbound_request|opportunity_signal|not_lead","services":["website|mobile_app|pos|crm|erp|ecommerce|booking|ordering|marketing|automation|seo|branding|cloud|integrations|wifi_cards"],"business_type":"cafe|restaurant|clinic|retail|gym|salon|pharmacy|real_estate|law_firm|factory|education|","intent":"VERY_HIGH|HIGH|MEDIUM|LOW|NONE","score":0-99,"urgency":"high|medium|low","reason":"سبب قصير بالعربي","language":"ar|en"}. ` +
          `لا تخترع بيانات غير موجودة. القيم المسموحة فقط.`,
      },
      { role: "user", content: text },
    ],
    { workspaceId, runType: "CLASSIFICATION", leadId, temperature: 0.1, maxTokens: 500, task: "classify" },
  )
  if (result && typeof result.is_lead === "boolean") {
    // Normalize/validate against contract
    result.services = asArray(result.services).filter((s) => VALID_SERVICES.has(s))
    if (!["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "NONE"].includes(result.intent)) result.intent = "NONE"
    result.score = Math.max(0, Math.min(99, Number(result.score) || 0))
    return { classification: result, engine: "ai" }
  }
  return { classification: heuristic, engine: "heuristic" }
}
