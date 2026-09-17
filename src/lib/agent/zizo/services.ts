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
    signals: /إعلانات|اعلانات|إعلان|اعلان|إعلاناتي|اعلاناتي|ميديا|media|ads|فيسبوك اعلان|على فيسبوك|على جوجل|جوجل ادز|google ads|تيك توك اعلان|حملة|كمبين|campaign|تارجتنج|targeting|روست|boost/i,
  },
  // ─── خدمات التسويق الإضافية (بحث سوق 2025) ───
  {
    id: "social",
    name: "إدارة سوشيال ميديا",
    nameEn: "Social Media Management",
    pitch: "صفحاتك بتتغذى وترد على الناس كل يوم — حضور مستمر من غير ما تشيل هم",
    examples: ["خطة شهرية وبوستات وتفاعل يومي", "رد آلي على التعليقات والرسايل", "تقارير شهرية بالنمو"],
    signals: /ادارة صفحات|إدارة صفحات|ادارة صفحة|إدارة صفحة|سوشيال|social media|انستجرام|إنستجرام|instagram|فيسبوك بيدج|صفحة فيسبوك|صفحة الفيسبوك|بوستات شهرية|تفاعل|متابعين|followers/i,
  },
  {
    id: "seo",
    name: "SEO وتحسين محركات البحث",
    nameEn: "SEO",
    pitch: "موقعك يطلع أول نتايج جوجل لما عملاؤك يدوروا — زباين مجانية كل شهر",
    examples: ["ظهور أول في بحث «دكتور أسنان في مصر الجديدة", "تحسين جوجل بيزنس ومراجعات", "سيو للمتجر ومصفحات المنتجات"],
    signals: /سيو|seo|تحسين محركات|محركات البحث|ترتيب جوجل|ظهور جوجل|نتايج البحث|نتائج البحث|جوجل بيزنس|خرايط جوجل|خرائط جوجل|google my business|كلمات مفتاحية/i,
  },
  {
    id: "content",
    name: "محتوى وكتابة إبداعية",
    nameEn: "Content & Copywriting",
    pitch: "كلام بيبيع — بوستات ومقالات وسيناريوهات بتقنع العميل إنه ياخد قرار",
    examples: ["سيناريوهات ريلز شهرية", "مقالات بتجيب زوار من جوجل", "كوبي إعلانات بتقلل تكلفة النقرة"],
    signals: /محتوى|محتوي|كتابة محتوى|كوبي|copywriting|سيناريو|سيناريوهات|مقالات|بودكاست|نص اعلان|نص إعلان|سوشيال كونتنت/i,
  },
  {
    id: "video",
    name: "فيديو وموشن",
    nameEn: "Video & Motion",
    pitch: "فيديو هو الملك دلوقتي — ريلز وإعلانات مصورة وموشن جرافيك بتخلي البراند يبان",
    examples: ["ريلز أسبوعية للمطعم", "إعلان مصور للمنتج", "موشن جرافيك يشرح الخدمة في 60 ثانية"],
    signals: /فيديو|مونتاج|موشن|motion|ريلز|reels|شورتس|shorts|يوتيوب|youtube|تصوير|فوتوغراف|تصوير منتجات|فويس أوفر|voice over/i,
  },
  {
    id: "influencer",
    name: "تسويق بالمؤثرين",
    nameEn: "Influencer Marketing",
    pitch: "مؤثرين بتكلم جمهورك — وصول سريع لجمهور جاهز بثقة جاهزة",
    examples: ["حملة مؤثرين لمطعم جديد", "مراجعات منتجات مع صناع محتوى", "سفراء براند شهريين"],
    signals: /مؤثر|مؤثرين|انفلونسر|إنفلونسر|influencer|مشاهير|سفراء|صناع محتوى|creators/i,
  },
  {
    id: "email",
    name: "إيميل وواتساب ماركتنج",
    nameEn: "Email & WhatsApp Marketing",
    pitch: "الزباين القدام أرخص زبون — رسايل مخصصة بتجيب تكرار شراء وعروض بتوصل",
    examples: ["نيوزليتر شهري لقايمة العملاء", "حملات واتساب للعروض", "رسايل استرداد للسلات المتروكة"],
    signals: /ايميل ماركتنج|إيميل ماركتنج|email marketing|رسايل واتساب|واتساب ماركتنج|whatsapp marketing|نيوزليتر|newsletter|سلة متروكة|حملات بريد/i,
  },
  {
    id: "branding",
    name: "براندينج واستراتيجية",
    nameEn: "Branding & Strategy",
    pitch: "مش بس شكل — تموضع واضح وخطة تسويق عشان البراند يبان ويبقى له معنى",
    examples: ["استراتيجية تسويق سنوية بالأرقام", "تموضع براند وهوية لفظية", "خطة إطلاق منتج جديد"],
    signals: /براند|براندينج|branding|استراتيجية تسويق|استراتيجيه|خطة تسويق|تموضع|positioning|إطلاق|لاونش|launch/i,
  },
  // ─── خدمات البرمجة الإضافية ───
  {
    id: "uiux",
    name: "تصميم UI/UX",
    nameEn: "UI/UX Design",
    pitch: "واجهات مريحة وسهلة — المستخدم يوصل للي عايزه في ثواني من غير حيرة",
    examples: ["تصميم تطبيق كامل قبل البرمجة", "إعادة تصميم موقع بتحويل ضعيف", "نظام تصميم موحد للمنتج"],
    signals: /ui ?\/ ?ux|ux design|تجربة مستخدم|واجهات|واجهة|figma|نموذج أولي|نموذج اولي|prototype|وايرفريم|wireframe/i,
  },
  {
    id: "support",
    name: "صيانة ودعم واستضافة",
    nameEn: "Maintenance & Hosting",
    pitch: "نظامك شغال دايمًا — تحديثات ونسخ احتياطي ودعم سريع لو حصلت مشكلة",
    examples: ["عقد صيانة شهري للموقع", "استضافة ونطاق وبريد رسمي", "نسخ احتياطي تلقائي ومراقبة"],
    signals: /صيانة|دعم فني|استضافة|يستضيف|hosting|سيرفر|server|نطاق|دومين|domain|نسخ احتياطي|backup|تحديث الموقع|مشاكل الموقع/i,
  },
]

export const SERVICES_DIGEST =
  "البرمجة: أنظمة وسوفتوير على المقاس، مواقع ومتاجر إلكترونية، تطبيقات موبايل، تصميم UI/UX، أتمتة وربط أنظمة، وكلاء ذكاء اصطناعي، صيانة ودعم واستضافة | التسويق: إدارة إعلانات فيسبوك/جوجل/تيك توك، إدارة سوشيال ميديا، SEO، محتوى وكتابة، فيديو وموشن وريلز، مؤثرين، إيميل وواتساب ماركتنج، براندينج واستراتيجية | التصميم: هوية بصرية ولوجو وتصاميم سوشيال"

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
