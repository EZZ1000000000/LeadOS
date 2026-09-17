// LeadOS — كتالوج خدمات وكالة زيزو
// زيزو بيع بس اللي مكتوب هنا — وبيعرف يحوّل كلام العميل للخدمة المناسبة.

export interface AgencyService {
  id: string
  name: string
  nameEn: string
  pitch: string // إزاي يبيعها — سطر واحد يتفهم
  examples: string[] // أمثلة تسوقها في الكلام (بشرية)
  signals: RegExp // إشارات كلام العميل اللي تدل على الخدمة دي
}

export const AGENCY_SERVICES: AgencyService[] = [
  {
    id: "software",
    name: "برمجة وسوفتوير",
    nameEn: "Custom Software",
    pitch: "أنظمة وبرامج على مقاس البزنس بأي حجم — من أداة صغيرة لمنصة كاملة",
    examples: ["نظام إدارة كامل للمخازن والفروع", "برنامج كاشير وربط فروع", "منصة SaaS على فكرتك"],
    signals: /نظام|سوفتوير|software|برنامج|erp|crm|إدارة|ادارة|منصة|platform|اكبر من موقع/i,
  },
  {
    id: "web",
    name: "مواقع إلكترونية",
    nameEn: "Websites",
    pitch: "مواقع سريعة وشكلها محترف تجيب عملاء — لاندينج أو موقع كامل بمتجر",
    examples: ["موقع لاندينج يجيب عملاء من الإعلانات", "متجر إلكتروني كامل بالدفع أونلاين", "موقع شركة بلوغات وسِو"],
    signals: /موقع|ويب|website|web|لاندينج|landing|متجر|ecommerce|ستور|shop|بورتفوليو/i,
  },
  {
    id: "mobile",
    name: "تطبيقات موبايل",
    nameEn: "Mobile Apps",
    pitch: "تطبيقات iOS و Android — أندرويد وأيفون بنفس الجودة، مع لوحة تحكم",
    examples: ["تطبيق دليفري مع تتبع", "تطبيق حجز مواعيد بإشعارات", "تطبيق متجر بإشعارات العروض"],
    signals: /تطبيق|أبلكيشن|app|موبايل|mobile|اندرويد|android|ايفون|ios|فلاتر|flutter/i,
  },
  {
    id: "graphic",
    name: "جرافيك وهوية بصرية",
    nameEn: "Graphic Design",
    pitch: "لوجو وهوية كاملة وتصاميم سوشيال ميديا تخلي البراند شكله يفرق",
    examples: ["هوية كاملة لوجو + ألوان + ستيشنري", "تصاميم بوستات شهرية للسوشيال", "بروفايل شركة وتصميم عروض"],
    signals: /لوجو|logo|هوية|تصميم|جرافيك|graphic|فوتوشوب|photoshop|بوستات|بروشور|بنر|ريتاتش|retouch|فلير/i,
  },
  {
    id: "automation",
    name: "أتمتة العمليات",
    nameEn: "Automation",
    pitch: "ربط الأنظمة بأوتوماتيك — بيانات تتحرك لوحدها وعمليات شغالة من غير تدخل",
    examples: ["أوتوميشن لفاتورة ورديفير المرتبات", "ربط الفورم بالشيت والواتساب تلقائي", "تقارير تجمع نفسها كل يوم"],
    signals: /أوتوميشن|اتوميشن|automation|أتمتة|اتمتة|zapier|make|ربط|تكامل|integration|تلقائي/i,
  },
  {
    id: "agents",
    name: "وكلاء ذكاء اصطناعي",
    nameEn: "AI Agents",
    pitch: "أجنتس AI بترد على العملاء وتحجز وتبيع 24 ساعة — بروح بشرية",
    examples: ["أجنت واتساب يرد على عملاء المتجر ويحجز", "بوت بيجيب الليدز ويفلترهم", "أجنت يساعد فريق الدعم بردود جاهزة"],
    signals: /ذكاء اصطناعي|شات بوت|chatbot|bot|أيجنت|ايجنت|agent|أجنت|بوت|gpt|openai|ai/i,
  },
  {
    id: "media",
    name: "ميديا بينج",
    nameEn: "Media Buying",
    pitch: "إدارة إعلانات فيسبوك وإنستجرام وجوجل وتيك توك — ميزانية بتجيب نتايج مش بس مشاهدات",
    examples: ["حملات إعلانات تجيب عملاء للمطعم", "ريتارجتنج للي الزار الموقع ومششترى", "تحسين تكلفة العميل الواحد شهر بشهر"],
    signals: /إعلانات|اعلانات|ميديا|media|ads|fads|فيسبوك اعلان|جوجل ادز|google ads|تيك توك اعلان|tiktok|حملة|كمبين|campaign|تارجتنج|targeting|روست|boost/i,
  },
]

export const SERVICES_DIGEST =
  "برمجة وسوفتوير بأي حجم (أنظمة ومنصات)، مواقع ومتاجر إلكترونية، تطبيقات موبايل، جرافيك وهوية بصرية، أتمتة عمليات وربط أنظمة، وكلاء ذكاء اصطناعي (أجنتس)، وميديا بينج (إدارة إعلانات فيسبوك/جوجل/تيك توك)"

/** استخراج اسم الوكالة من إعدادات الورشة (قابل للتخصيص من الإعدادات) */
export function agencyNameOf(wsSettings: unknown): string {
  const s = (wsSettings ?? {}) as { zizo?: { agencyName?: string; agencyCity?: string } }
  return s?.zizo?.agencyName?.trim() || "الوكالة"
}

/** إعدادات زيزو الافتراضية للورشة */
export interface ZizoConfig {
  agencyName: string
  liveCallHours: string // ساعات الشغل المتاحة للمكالمات
  autoOutreach: boolean // مبادرة تواصل مع الليدز تلقائيًا؟
  minOutreachScore: number // أقل سكور ليد يستاهل مبادرة
  maxDailyOutreach: number // سقف مبادرات يومي (بشري)
}

export const ZIZO_DEFAULTS: Omit<ZizoConfig, "agencyName"> = {
  liveCallHours: "من 11 الصبح لـ 8 بالليل",
  autoOutreach: true,
  minOutreachScore: 60,
  maxDailyOutreach: 12,
}

export function zizoConfigOf(wsSettings: unknown): ZizoConfig {
  const s = (wsSettings ?? {}) as { zizo?: Partial<ZizoConfig> }
  return { ...ZIZO_DEFAULTS, ...(s?.zizo ?? {}), agencyName: agencyNameOf(wsSettings) }
}

/** تحميل كلام العميل → الخدمات الأنسب (ترتيب بالأقوى) */
export function matchServices(text: string): AgencyService[] {
  const scored = AGENCY_SERVICES.map((s) => {
    const hits = text.match(new RegExp(s.signals.source, "gi"))?.length ?? 0
    return { s, hits }
  })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map((x) => x.s)
  return scored
}

/** سطر مساعدة لبرومبت زيزو: الخدمات المرشحة من كلام العميل */
export function servicesHint(text: string): string {
  const m = matchServices(text)
  if (!m.length) return "لم تظهر حاجة واضحة لخدمة بعينها بعد — اكتشف أكتر قبل ما تعرض."
  return `خدمات مرشحة من كلام العميل (الأقرب أولًا): ${m
    .slice(0, 3)
    .map((s) => `${s.name} — ${s.pitch}`)
    .join(" | ")}`
}
