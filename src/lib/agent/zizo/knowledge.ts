// LeadOS — قاعدة معرفة زيزو السوقية (مصادر العملاء + أماكن تواجدهم)
// مبنية على بحث سوق حقيقي (14 بحث ويب — مصر + الخليج + عالمي، 2025)
// زيزو مش بيبدأ من الصفر: المعرفة دي بتُسَمَّ في ذاكرته (AgentInsight) وبتُحقن في برومبتاته.
import { db } from "@/lib/db"

export type Region = "EG" | "GULF" | "GLOBAL"

export interface LeadSource {
  id: string
  name: string
  region: Region
  kind: string // facebook_groups | whatsapp | directory | maps | marketplace | freelance | community | linkedin | reddit | jobs
  what: string // فيه إيه بالظبط
  how: string // إزاي تصطاد منه صح (من غير سبام)
  fit: string // مناسب لصيد مين
  hunt: string[] // استعلامات جاهزة للأيجنت الصياد
}

// ─── مصادر الشتات — مصر ───
export const LEAD_SOURCES: LeadSource[] = [
  {
    id: "eg-fb-restaurants",
    name: "جروبات فيسبوك لأصحاب المطاعم والكافيهات في مصر",
    region: "EG",
    kind: "facebook_groups",
    what: "جروبات نشطة زي «أصحاب كافيهات ومطاعم مصر» و«أصحاب المطاعم والكافيهات في مصر» — أصحاب بيزنس بيسألوا ويشتكوا ويتبادلوا توريدات",
    how: "قيمة قبل البيع: رد على أسئلة التشغيل والتسويق بخبرة حقيقية، وبعد تفاعلين تلاتة افت DM شخصي — ممنوع اعلان جاهز في الجروب",
    fit: "مطاعم، كافيهات، أوتدورات، مطابخ تجارية",
    hunt: ["site:facebook.com جروب اصحاب مطاعم كافيهات مصر", "اصحاب مطاعم مصر فيسبوك جروب"],
  },
  {
    id: "eg-fb-sme",
    name: "جروبات أصحاب المشاريع الصغيرة والمتوسطة",
    region: "EG",
    kind: "facebook_groups",
    what: "جروبات زي «مشروعك» — آلاف أصحاب مشاريع بيسألوا عن بداية وتشغيل وتسويق (ممنوع فيها الاعلان المباشر)",
    how: "كن المرجع: جاوب أسئلة التسويق والأنظمة بإجابات مفيدة، صفحتك الشخصية تحكي شغلك — أصحاب المشاريع بيدوروا على مغلوب أمانة مش بيدوروا على اعلان",
    fit: "كل المشاريع الناشئة، تجار تجزئة، خدمات",
    hunt: ["site:facebook.com جروب مشروعك اصحاب المشاريع مصر", "جروبات اصحاب المشاريع الصغيرة مصر فيسبوك"],
  },
  {
    id: "eg-whatsapp-merchants",
    name: "جروبات واتساب وتليجرام للتجار («اعلانات تجار مصر» وغيرها)",
    region: "EG",
    kind: "whatsapp",
    what: "مئات جروبات البيع والشراء والإعلانات المبوبة — تجار جملة وتجزئة بنشروا منتجاتهم يوميًا",
    how: "التجار اللي بيرسلوا عروض كل يوم = بيزنس حي وعنده فلوس تسويق. راسلهم كإنك بتعاون مع تجار في مجالهم — عرض واحد مختصر، مش كتالوج",
    fit: "تجار جملة، موزعين، متاجر محلية",
    hunt: ["اعلانات تجار مصر واتساب جروب", "جروبات واتساب تجار جملة مصر"],
  },
  {
    id: "eg-yellowpages",
    name: "يلوبيدجز مصر (Yellow Pages Egypt)",
    region: "EG",
    kind: "directory",
    what: "دليل أعمال مصنف بالكامل: كل نشاط × كل محافظة بأرقام تليفونات وعناوين مباشرة",
    how: "الصيد المنظم: اختار النشاط والمنطقة، اطلع القايمة، رتبها بالأولوية (شركات عندها موقع باظ/مفيش) وابدأ واتساب شخصي مش رسالة جماعية",
    fit: "شركات خدمية، مصانع صغيرة، مكاتب، تجار",
    hunt: ["site:yellowpages.com.eg مطاعم", "site:yellowpages.com.eg شركات برمجة", "يلوبيدجز مصر عيادات"],
  },
  {
    id: "eg-company-directory",
    name: "دليل الشركات المصرية + Egypt Business Directory",
    region: "EG",
    kind: "directory",
    what: "قواعد بيانات شركات مصرية بـتليفونات ومسئولين ومواقع (الدليل التجاري الأقدم — من 1998)",
    how: "بيانات جاهزة للفلترة: فلتر بالحجم والنشاط، واهتم بالشركات اللي بياناتها متقنة (بتدفع على حضورها) لكن موقعها قديم — دول جاهزين للتطوير",
    fit: "شركات متوسطة، مكاتب استشارات، موزعين",
    hunt: ["دليل الشركات المصرية بيانات اتصال", "site:egypt-business.com شركات"],
  },
  {
    id: "eg-industrial",
    name: "الموسوعة الصناعية المصرية (آراب آد)",
    region: "EG",
    kind: "directory",
    what: "أكبر دليل مصانع في مصر — 15,000+ مصنع وشركة في المدن الصناعية (العاشر، برج العرب، السادات، بدر)",
    how: "منجم B2B للبرمجة: المصانع دي عندها دفاتر وإكسل — عرض أنظمة مخازن وإنتاج وERP بيبدأ بمكالمة قصيرة لمدير الIT أو المدير العام",
    fit: "مصانع (أنظمة ERP/أتمتة/مواقع كتالوج)، تجار جملة",
    hunt: ["الموسوعة الصناعية المصرية مصانع", "دليل مصانع مصر المدن الصناعية بيانات"],
  },
  {
    id: "eg-maps",
    name: "خرائط جوجل — مصر",
    region: "EG",
    kind: "maps",
    what: "كل بزنس محلي بعنوان وتليفون وموقع ومراجعات — أعلى تغطية لأي نشاط في أي منطقة",
    how: "فلاتر الذهب: (1) مراجعات كتير لكن آخر ردود قديمة = صفحة مهملة (2) مراجعات سلبية عن الحجز/الرد = نفس ألم اللي بنحله (3) مفيش موقع في البروفايل = أول عرض موقع",
    fit: "كل البزنس المحلي: مطاعم، عيادات، صالونات، جيمات، ورش",
    hunt: ["عيادات اسنان القاهرة خرايط جوجل", "مطاعم مدينة نصر", "صالونات تجميل الجيزة خرائط"],
  },
  {
    id: "eg-marketplaces",
    name: "أوليكس (OLX) + هاتلا2ee وإعلانات مبوبة مصرية",
    region: "EG",
    kind: "marketplace",
    what: "آلاف البايّعين النشطين: عقارات، سيارات، موبايلات، أثاث — اللي بينشر باستمرار غالبًا تاجر أو مكتب مش فرد",
    how: "البايع اللي ليه 30 إعلان = تاجر محتاج نظام إدارة وعرض أونلاين محترم. راسله على النشط: «شايف إعلاناتك كتير — بتنظمها إزاي؟»",
    fit: "تجار سيارات، مكاتب عقارات، تجار أجهزة وأثاث",
    hunt: ["site:olx.com.eg عقارات للبيع", "هاتلا2ee سيارات تجار", "site:hatla2ee.com سيارات"],
  },
  {
    id: "eg-instagram-tiktok",
    name: "انستجرام وتيك توك — الهاشتاجات والبيدجات المصرية",
    region: "EG",
    kind: "community",
    what: "بوتيكات وصالونات ومطاعم بتنشر يوميًا — كتير منهم بتصور بموبايل ومفيش استراتيجية ولا رد على الرسايل",
    how: "التفاعل قبل الـDM: كومنتات حقيقية على 3 بوستات، وبعدها DM بملحوظة حقيقية عن محتواهم — الـDM الفاضي بيتقفل",
    fit: "بوتيكات، صالونات، مطاعم، براندات منتجات",
    hunt: ["مطاعم القاهرة انستجرام", "بوتيكات مصرية انستجرام", "صالونات تجميل مصر تيك توك"],
  },
  {
    id: "eg-jobs",
    name: "بوابات الوظائف المصرية (Wuzzuf ولينكدإن جوبز)",
    region: "EG",
    kind: "jobs",
    what: "شركات بتعلن عن توظيف «مسؤول تسويق/سوشيال/IT» بشكل متكرر — يعني الحاجة قائمة وبيصرفوا عليها",
    how: "الزاوية الذهبية: «قبل ما توظف براتب سنوي — وكالة بتديك نفس النتيجة بتكلفة أقل وبدون صداع توظيف» — الشركات اللي بتعيد الإعلان كل شهر هي الأسخن",
    fit: "شركات متوسطة لسه مبقتش عندها فريق تسويق",
    hunt: ["site:wuzzuf.net مسؤول تسويق", "وظائف social media specialist مصر"],
  },
  // ─── مصادر عربية/خليجية ───
  {
    id: "ar-freelance",
    name: "منصات العمل الحر العربية (مستقل، خمسات، بحر، شغل أونلاين، تصميمي)",
    region: "GULF",
    kind: "freelance",
    what: "مشاريع منشورة من عملاء عرب بدفع فعلًا: مواقع، تطبيقات، تسويق، تصميم — العميل الجديد بيشارك مشروعه وهو جاهز يصرف",
    how: "مين اللي بيقدم عروض؟ للوكالة: اللي بيرفع مشاريع متكررة نفس العميل = عقد شهري محتمل. وكمان ملفات المنافسين بتعلمك أسعار السوق",
    fit: "عملاء من كل العالم العربي — خاصة الخليج",
    hunt: ["مستقل مشاريع مواقع", "خمسات خدمات تسويق", "موقع بحر للعمل الحر مشاريع"],
  },
  {
    id: "gulf-remote",
    name: "سوق الخليج عن بُعد (السعودية، الإمارات، قطر)",
    region: "GULF",
    kind: "linkedin",
    what: "بيزنسات خليجية بتدفع أضعاف المصري وبتتعامل ريموت مع وكالات مصرية — خصوصًا مطاعم وعيادات وعقارات ومتاجر",
    how: "ابحث بالإنجليزي والعربي عن «مطاعم الرياض/دبي» في الخرائط وإنستجرام — افتتح بجودة وسرعة الرد كنقطة قوة المصرية، والفاتورة بالدولار بيفرق جدا",
    fit: "كل الخدمات — أسعار أعلى بنفس الشغل",
    hunt: ["مطاعم الرياض انستجرام", "عيادات دبي خرايط جوجل", "شركات صغيرة دبي تسويق"],
  },
  // ─── مصادر عالمية ───
  {
    id: "global-linkedin",
    name: "لينكدإن + Sales Navigator",
    region: "GLOBAL",
    kind: "linkedin",
    what: "أقوى قاعدة B2B في العالم: فلترة بالصناعة × حجم الشركة × المنصب (مالك، مدير تسويق، مدير عمليات)",
    how: "الرسالة الأولى ما فيهاش عرض: تعليق على بوست أو سؤال عن شغلهم، وبعد الرد افتح كلام الحاجة. Sales Navigator بيوفر 20+ فلتر مجاني تجريبي",
    fit: "B2B: مصانع، شركات برمجيات، شركات خدمات، SaaS",
    hunt: ["site:linkedin.com/in مدير تسويق مصر", "linkedin founders small business egypt"],
  },
  {
    id: "global-reddit",
    name: "ريديت — r/smallbusiness وr/ecommerce وr/shopify وr/dropshipping",
    region: "GLOBAL",
    kind: "reddit",
    what: "مئات آلاف أصحاب بيزنس بيشتكوا من مشاكل حقيقية: «موقعي بيرفض يبيع»، «الإعلانات غالية»، «محتاج تطبيق» — بالأسماء والتفاصيل",
    how: "جاوب المشكلة بعمق حقيقي أول، وذكرك في آخر سطر. الـDM المباشر بيتبلوك — الكومنت القوي هو اللي بيجيب الرسايل لوحدها",
    fit: "عملاء عالميين بالدولار: متاجر، SaaS، خدمات",
    hunt: ["reddit small business website help", "site:reddit.com/r/ecommerce developer needed", "site:reddit.com/r/shopify marketing agency"],
  },
  {
    id: "global-fb-groups",
    name: "جروبات فيسبوك العالمية (Shopify Entrepreneurs وEcommerce Owners)",
    region: "GLOBAL",
    kind: "facebook_groups",
    what: "جروبات ضخمة لملاك المتاجر والوكالات — ناس بتسأل «مين يبني لي متجر؟» يوميًا",
    how: "عروض البناء ممنوعة غالبًا — بس في فولدر «Hire me/Services» بخبي بيدجات الوكالات: اتساب فيه بورتفوليو قوي",
    fit: "عملاء عالميين، متاجر، براندات",
    hunt: ["shopify entrepreneurs facebook group", "ecommerce business owners facebook group"],
  },
  {
    id: "global-directories",
    name: "أدلة الوكالات العالمية (Clutch، DesignRush) وUpwork/Fiverr",
    region: "GLOBAL",
    kind: "freelance",
    what: "معلومات استخبارات ذهبية: مين الوكالات المطلوبة، بأي أسعار، وتقييمات عملائهم — وكمان عملاء بيدوروا بنفسهم على مزود خدمة",
    how: "للبيع: بروفايل واكتيف على Upwork بيجيب مشاريع. للاستخبارات: اقري مراجعات عملاء المنافسين — كل شكوى في المراجعات = زاوية بيع ليك",
    fit: "عملاء عالميين + تعلم أسعار السوق وزوايا المنافسين",
    hunt: ["site:clutch.co agencies egypt", "upwork web development jobs"],
  },
]

// ─── خريطة تواجد العملاء: كل نوع عميل بيتواجد فين وبيتألم من إيه ───
export interface ClientPresence {
  id: string
  industry: string
  keywords: RegExp
  where: string[] // أماكن تواجدهم الفعلية
  pains: string[] // نقط ألم متكررة (زاوية البيع)
  bestServices: string[] // service ids من الكتالوج
  angle: string // جملة الافتتاح الذكية
}

export const CLIENT_PRESENCE: ClientPresence[] = [
  {
    id: "restaurants",
    industry: "مطاعم وكافيهات",
    keywords: /مطعم|مطاعم|كافيه|كافيهات|مقهى|restaur|cafe|coffee/i,
    where: ["جروبات فيسبوك لأصحاب المطاعم في مصر", "خرائط جوجل (أعلى كثافة بزنس محلي)", "انستجرام وتيك توك", "منصات الدليفري (الطلب أونلاين/إلمنيشنز)"],
    pains: ["مينيو وحجز أونلاين ضعيف", "إعلانات بتجيب مشاهدات مش زباين", "مراجعات سلبية من غير رد", "اعتماد كامل على الدليفري وعمولاته"],
    bestServices: ["web", "media", "social", "video"],
    angle: "المينيو الرقمي والحجز المباشر بيقلل عمولة التطبيقات وبيزود هامش الربح",
  },
  {
    id: "clinics",
    industry: "عيادات وأطباء",
    keywords: /عياد|عيادات|طبيب|دكتور|دكتورة|أسنان|اسنان|جلدية|أسنان|مستشفى|مركز طبي|clinic|doctor|dentist/i,
    where: ["خرائط جوجل", "منصات حجز الأطباء (دكتورتوزي/فيتاين)", "جروبات فيسبوك الصحية بالمحافظة", "واتساب (المرضى بيسألوا فيه)"],
    pains: ["مفيش نظام حجز والحجز بالتليفون بيضيع مرضى", "الرد على الاستفسارات متأخر بعد الدوام", "سمعة أونلاين مش متداركة"],
    bestServices: ["agents", "web", "social"],
    angle: "أجنت بيرد على المرضى ويحجز مواعيد 24 ساعة — حتى بعد الدوام وكل رمضان",
  },
  {
    id: "realestate",
    industry: "عقارات ومكاتب عقارية",
    keywords: /عقار|عقارات|شقق|فيلا|اراضي|أراضي|تطوير عقاري|مكتب عقار|real ?estate/i,
    where: ["فيسبوك ماركت بليس وجروبات البيع والشراء", "هاتلا2ee وأولين سوق", "جروبات فيسبوك العقارية بالمحافظة", "انستجرام للكومباوندات"],
    pains: ["ليدز كتير مش جادين بيهدر وقت السيلز", "متابعة العملاء دفاتر وواتساب", "صور وأبروج ضعيفة مش بتبيع الوحدة"],
    bestServices: ["web", "automation", "media"],
    angle: "نظام CRM بيفلتر الجادين أوتوماتيك وموقع بعرض 3D بدل صور الموبايل",
  },
  {
    id: "ecommerce",
    industry: "متاجر إلكترونية وتجار",
    keywords: /متجر|متاجر|بيع اونلاين|أونلاين|شوبيفاي|shopify|ايكومرس|ecommerce|تجارة|متجري|ستور/i,
    where: ["r/shopify وr/ecommerce وr/dropshipping", "جروبات فيسبوك للتجار المصريين والعالميين", "أوليكس OLX (اللي بيكبروا منه)", "انستجرام شوبينج"],
    pains: ["نسبة مرتجعات كود مرتفعة", "معدل تحويل ضعيف من الزيارات", "مخزون وشحن بيتداروا يدوي", "سلات متروكة محدش بيرجع لها"],
    bestServices: ["web", "automation", "media", "email"],
    angle: "تقليل المرتجعات برسايل تأكيد وربط الشحن أوتوماتيك = فلوس راجعة في جيبك",
  },
  {
    id: "gyms",
    industry: "صالات رياضية وجيمات",
    keywords: /جيم|نادي|صالة رياضية|جم|gym|fitness|كروسفيت|يوغا/i,
    where: ["انستجرام وتيك توك", "خرائط جوجل", "جروبات فيسبوك الخاصة بالحي/المدينة", "تحديات واتساب الجماعية"],
    pains: ["اشتراكات بتنزل بعد الشهر الأول", "مفيش متابعة للأعضاء الغايبين", "محتوى بيكرر نفسه"],
    bestServices: ["media", "social", "automation"],
    angle: "حملة استهداف للجيمنج في نطاق 5 كم + نظام متابعة أعضاء بيرجع الغايبين",
  },
  {
    id: "education",
    industry: "تعليم ودروس ومراكز تدريب",
    keywords: /تعليم|دروس|سنتر|مراكز تدريب|كورس|مدرسة|أكاديمية|اكاديمية|course|training|تأسيس/i,
    where: ["جروبات فيسبوك لأولياء الأمور والطلبة", "يوتيوب", "جروبات أولياء أمور المدارس", "تيك توك التعليمي"],
    pains: ["تسجيل الطلاب ورق وواتساب بيلخبط", "إعلانات موسمية وقت الدراسة بس", "مفيش نظام متابعة مستويات"],
    bestServices: ["web", "agents", "media"],
    angle: "بوابة كورسات بحجز وتسجيل أونلاين + أجنت بيرد على أسئلة الأهالي فورًا",
  },
  {
    id: "hotels",
    industry: "فنادق وسياحة وشاليهات",
    keywords: /فندق|فنادق|شاليه|سياحة|سياحه|منتجع|hotel|resort|تخييم/i,
    where: ["Booking وTripAdvisor", "انستجرام", "خرائط جوجل", "جروبات السفر المصريين"],
    pains: ["حجوزات بتتم بره مصر بعمولة 15%+", "محتوى مش بيعبر عن المكان", "الرد على الاستفسارات بالتليفون بس"],
    bestServices: ["web", "video", "media"],
    angle: "موقع بحجز مباشر بدل عمولة المنصات — 15% من كل حجز بترجع ليك",
  },
  {
    id: "factories",
    industry: "مصانع وتجار جملة",
    keywords: /مصنع|مصانع|توريد|جملة|انتاج|إنتاج|خط إنتاج|factory|wholesale|تصنيع/i,
    where: ["الموسوعة الصناعية المصرية", "دليل الشركات المصرية", "لينكدإن", "معارض ومجموعات صناعة"],
    pains: ["إدارة المخازن والإنتاج دفاتر وإكسل", "مفيش حضور B2B أونلاين", "طلبات العملاء بالتليفون بتتضيع"],
    bestServices: ["software", "web", "automation"],
    angle: "نظام مخازن وإنتاج بدل الدفاتر — يعرف المخزون وكل أمر إنتاج في ثانية من موبايله",
  },
  {
    id: "legal",
    industry: "محامون ومكاتب استشارات",
    keywords: /محام|مكتب محاماة|استشارات قانونية|محاماة|lawyer|law ?firm|قانوني/i,
    where: ["لينكدإن", "جروبات فيسبوك القانونية والبيزنس", "خرائط جوجل"],
    pains: ["سمعة شفهي بس ومفيش أثر أونلاين", "مفيش موقع ولا محتوى يوثق خبرتهم", "استفسارات العملاء بدون تنظيم"],
    bestServices: ["web", "seo", "content"],
    angle: "أول مكتب يظهر لما حد يدور «محامي شركات في مصر» — الاستشارة الأولى بتجي لوحدها",
  },
  {
    id: "cars",
    industry: "تجار سيارات ومعارض",
    keywords: /سيارات|معرض سيارات|بيع سيارات|سياره|cars|dealer|هاتلا/i,
    where: ["هاتلا2ee وأولين سوق", "جروبات فيسبوك لبيع وشراء السيارات", "تيك توك (جولات على السيارات)"],
    pains: ["صور موبايل بلا تنظيم", "متابعة الزباين المهتمين ورق", "الأسعار مش محدثة في كل مكان"],
    bestServices: ["web", "media", "automation"],
    angle: "معرض أونلاين بفلتر وسعر محدث تلقائي + نظام متابعة لكل زبون شاف سيارة",
  },
  {
    id: "beauty",
    industry: "صالونات وعيادات تجميل",
    keywords: /صالون|تجميل|سبا|hair|beauty|ميكب|كوش|فرح|عيادة تجميل|بشره|بشرة/i,
    where: ["انستجرام (الأقوى في المجال)", "تيك توك", "خرائط جوجل", "جروبات الستات بالمحيط"],
    pains: ["الحجز على الواتساب بيلخبط المواعيد", "عروض من غير قياس نتايج", "صور قبل/بعد مش منظمة"],
    bestServices: ["agents", "social", "media"],
    angle: "أجنت حجز بيحدد المواعيد ويفتكر العميل قبل بيوم — الواتساب يرجع نظيف",
  },
  {
    id: "logistics",
    industry: "شحن ولوجستيات ومخازن",
    keywords: /شحن|نقل|لوجستيات|توصيل|shipping|logistics|مخازن|مستودع/i,
    where: ["لينكدإن", "جروبات التجار والمصدرين", "معارض اللوجستيات"],
    pains: ["تتبع شحنات يدوي والعميل بيسأل واتساب طول اليوم", "فواتير ومناديب بيتداروا ورق", "مفيش تقارير للأداء"],
    bestServices: ["software", "agents", "automation"],
    angle: "نظام تتبع بيرد على سؤال «شحنتي فين؟» أوتوماتيك — فريقك يركز في الشغل مش في الرد",
  },
]

// ─── حقائق سوق متراكمة (مصر/خليج/عالمي) ───
export const MARKET_FACTS: string[] = [
  "فيسبوك بيقود السوشيال في مصر بنسبة 83% — الحملات المصرية تتكلم فيسبوك أولًا، وانستجرام وتيك توك طبقة تانية للفئات الشابة",
  "الخليج (السعودية/الإمارات) بيدفع 2-4 أضعاف سعر مصر لنفس الشغل — وكالة مصرية بتخدم الخليج ريموت بتزود هوامشها بشكل كبير",
  "الصناعات الأكثر احتياجًا للتسويق الرقمي: الرعاية الصحية، العقارات، التعليم، المطاعم، التجارة الإلكترونية، والخدمات المنزلية",
  "خرائط جوجل أغنى مصدر لبيانات البزنس المحلي — أغنى من أي دليل: عنوان + تليفون + موقع + مراجعات مكتوبة فيها الآلام نفسها",
  "شركة بتعيد الإعلان على وظيفة «مسؤول تسويق» كل شهر = بتجرب وتفشل — أقوى فرصة لعرض وكالة بدل التوظيف",
  "المراجعات السلبية في خرائط جوجل عن «الرد» و«الحجز» = البزنس ده محتاج أجنت رد فورًا — ادخل عليها من نفس الألم",
  "العميل العربي على منصات العمل الحر بيدفع فعلًا — اللي بينشر مشروع تاني كل شهر عندك بمنصة مستقل هو عقد شهري في انتظارك",
]

// ─── مطابقات ───
export function matchIndustries(text: string): ClientPresence[] {
  if (!text) return []
  const scored = CLIENT_PRESENCE.map((p) => {
    const hits = text.match(new RegExp(p.keywords.source, "gi"))?.length ?? 0
    return { p, hits }
  })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map((x) => x.p)
  return scored
}

/** معرفة سوق لبرومبت زيزو وهو بيتكلم مع عميل: صناعته، أماكن تواجده، ألمه، الزاوية */
export function marketBrief(text: string): string {
  const inds = matchIndustries(text).slice(0, 2)
  if (!inds.length) return ""
  return inds
    .map(
      (p) =>
        `معرفتك بصناعة ${p.industry}:\n• ساعتها موجودين: ${p.where.join(" ، ")}\n• بيتألموا من: ${p.pains.join(" ، ")}\n• الزاوية اللي بتفتح الكلام: ${p.angle}\n• خدماتنا الأنسب لهم: ${p.bestServices.join(" ، ")}`,
    )
    .join("\n\n")
}

/** معرفة مصادر لبرومبت الصياد (الكيان): أفضل مصادر لهدف معين + استعلامات جاهزة */
export function sourceBrief(text: string, limit = 5): string {
  const inds = matchIndustries(text)
  const indFit = new Set(inds.flatMap((i) => [i.industry.split(" ")[0], i.industry]))
  const scored = LEAD_SOURCES.map((s) => {
    let score = 0
    for (const f of indFit) if (s.fit.includes(f)) score += 2
    if (text.match(/خرايط|خرائط|maps|محلي|local/i) && s.kind === "maps") score += 3
    if (text.match(/عربي|مصر/i) && s.region === "EG") score += 1
    if (text.match(/خليج|السعودية|الإمارات|دبي|الرياض/i) && s.region === "GULF") score += 2
    if (text.match(/انجليزي|إنجليزي|عالمي|global|english/i) && s.region === "GLOBAL") score += 2
    return { s, score }
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
  return scored
    .map((x) => `مصدر: ${x.s.name} (${x.s.region}) — ${x.s.what} • الأسلوب: ${x.s.how} • استعلام جاهز: «${x.s.hunt[0]}»`)
    .join("\n")
}

/** بذور الصيد للأيجنت: منصات مقترحة + استعلامات افتتاحية مجرّبة (الصناعة أولًا ثم المصادر) */
export function huntSeeds(text: string): { platforms: string[]; queries: string[] } {
  const platforms = new Set<string>()
  const queries: string[] = []
  const inds = matchIndustries(text)
  // الصناعة المحددة هي أهم بذرة — قبلها أي حاجة
  for (const i of inds.slice(0, 3)) {
    queries.push(`${i.industry} مصر`, `${i.industry} القاهرة خرايط جوجل`)
  }
  // المصادر المطبقة على الهدف
  for (const s of LEAD_SOURCES) {
    const rel =
      inds.some((i) => s.fit.includes(i.industry.split(" ")[0])) ||
      (s.region === "EG" && /مصر|مصري/.test(text)) ||
      /كل|أي|any|all/.test(text)
    if (!rel) continue
    if (s.kind === "maps") platforms.add("GOOGLE_MAPS")
    else if (s.kind === "facebook_groups" || s.kind === "whatsapp") platforms.add("FACEBOOK")
    else if (s.kind === "linkedin" || s.kind === "jobs") platforms.add("LINKEDIN")
    else if (s.kind === "community" && s.region === "GLOBAL") platforms.add("REDDIT")
    else platforms.add("GOOGLE_SEARCH")
    queries.push(...s.hunt.slice(0, 2))
  }
  if (!platforms.size) platforms.add("GOOGLE_SEARCH")
  return { platforms: [...platforms].slice(0, 5), queries: [...new Set(queries)].slice(0, 14) }
}

// ─── السَمّ في ذاكرة زيزو (AgentInsight)
async function seedIfMissing(wsId: string, kind: string, pattern: string, note: string): Promise<boolean> {
  const existing = await db.agentInsight.findFirst({ where: { workspaceId: wsId, kind, pattern } })
  if (existing) return false
  await db.agentInsight.create({
    data: { workspaceId: wsId, kind, pattern: pattern.slice(0, 120), note: note.slice(0, 400), weight: 1 },
  })
  return true
}

/** سَمّ المعرفة السوقية لورشة واحدة — idempotent (ما بيزودش الأوزان لو اتكرر) */
export async function seedWorkspaceKnowledge(wsId: string): Promise<number> {
  let n = 0
  // المصادر (أهم 10) — kind=sourcing عشان دروس الصيد
  for (const s of LEAD_SOURCES.slice(0, 10)) {
    if (await seedIfMissing(wsId, "sourcing", `مصدر مجرّب: ${s.name}`, `${s.what} — الأسلوب: ${s.how} (مناسب لـ${s.fit})`)) n++
  }
  // التواجد — kind=presence عشان دروس البيع
  for (const p of CLIENT_PRESENCE) {
    if (await seedIfMissing(wsId, "presence", `تواجد ${p.industry}`, `موجودين: ${p.where.join(" ، ")} — بيتألموا من: ${p.pains.join(" ، ")} — الزاوية: ${p.angle}`)) n++
  }
  // حقائق السوق — kind=market
  for (let i = 0; i < MARKET_FACTS.length; i++) {
    if (await seedIfMissing(wsId, "market", `حقيقة سوق #${i + 1}`, MARKET_FACTS[i])) n++
  }
  return n
}

/** تأكد رخيص إن الورشة متعلمة المعرفة — بيتنادى في كل نبضة/تشغيلة */
export async function ensureKnowledgeSeeded(wsId: string): Promise<void> {
  try {
    const c = await db.agentInsight.count({ where: { workspaceId: wsId, kind: { in: ["sourcing", "presence"] } } })
    if (c < 20) await seedWorkspaceKnowledge(wsId) // 10 مصادر + 12 صناعة = 22 على الأقل
  } catch {
    // السَمّ best-effort — مش بيكسر شغل زيزو
  }
}
