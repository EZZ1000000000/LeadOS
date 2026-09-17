// LeadOS — طبقة البشرية 100% لزيزو
// الفلتر النهائي قبل إرسال أي رسالة: تنظيف + كشف نبرة روبوت + توقيت كتابة واقعي

// ملاحظة: \b لا يعمل مع الحروف العربية في JS — الأنماط العربية substring مباشرة
const BANNED_PATTERNS: Array<[RegExp, string]> = [
  [/\*\*/g, ""],
  [/^\s*[-•*]\s+/gm, ""],
  [/مساعد افتراضي/g, "بصراحة"],
  [/مساعد ذكي/g, "بصراحة"],
  [/أنا بوت/g, "بصراحة"],
  [/ذكاء اصطناعي/g, "بصراحة"],
  [/بصفتي مساعد/g, ""],
  [/نموذج لغوي/g, ""],
  [/أنا برنامج/g, "ماشي"],
  [/\bI(?:'m| am) an AI\b/gi, "haha"],
  [/\bI(?:'m| am) a bot\b/gi, "haha"],
  [/لا تتردد في/g, "لو حابب"],
  [/هل هناك أي شيء آخر/g, "حاجة تانية؟"],
  [/يسعدني خدمتك/g, "تحت أمرك"],
  [/أرجو التفضل/g, "لو سمحت"],
  [/نحن نقدم/g, "احنا بنعمل"],
  [/عزيزي العميل/g, "يا باشا"],
]

const EMOJI_HEAVY = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu

/** تنظيف رسالة واحدة من أي أثر روبوت */
function cleanOne(msg: string): string {
  let s = msg.trim()
  for (const [re, rep] of BANNED_PATTERNS) s = s.replace(re, rep)
  s = s.replace(EMOJI_HEAVY, (m) => (Math.random() < 0.12 ? m : "")) // إيموجي نادر جدًا
  s = s.replace(/\s{2,}/g, " ").replace(/\n+/g, " ").trim()
  s = s.replace(/[.。]{2,}$/g, ".")
  return s
}

export interface HumanOut {
  msgs: string[] // رسائل شات نهائية مرتبة بالترتيب
  delaysMs: number[] // تأخير "كتابة" واقعي لكل رسالة قبل إرسالها
}

/**
 * تحويل ردّ زيزو الخام → سلسلة رسائل شات بشرية.
 * - يقسم الرسايل الطويلة جدًا لو الزيرو قسّمها غلط
 * - يشيل الرسايل الفاضية والمكررة
 * - يحسب زمن كتابة واقعي: ~150-260ms/حرف + هويس + وقفة بين الرسايل
 */
export function humanize(rawMsgs: string[]): HumanOut {
  const out: string[] = []
  for (const raw of rawMsgs ?? []) {
    let m = cleanOne(raw)
    if (!m) continue
    if (m.length > 220) {
      // رسالة طويلة زيادة عن اللزوم → قسّمها على جُمل
      const parts = m.split(/(?<=[.!؟?])\s+/).filter(Boolean)
      let buf = ""
      for (const p of parts) {
        if ((buf + " " + p).trim().length > 140) {
          if (buf.trim()) out.push(buf.trim())
          buf = p
        } else buf = `${buf} ${p}`.trim()
      }
      if (buf.trim()) out.push(buf.trim())
    } else {
      // منع تكرار نفس الرسالة مرتين
      if (out.length && out[out.length - 1].toLowerCase() === m.toLowerCase()) continue
      out.push(m)
    }
  }
  // حد أقصى 4 رسائل — الشات الحقيقي نادرًا يبعت أكتر في رد واحد
  const msgs = out.slice(0, 4)
  const delaysMs = msgs.map((m, i) => {
    const base = Math.min(m.length * 190, 4200) // زمن كتابة
    const jitter = 250 + Math.floor(Math.random() * 900)
    const between = i > 0 ? 500 + Math.floor(Math.random() * 1400) : 0
    return base + jitter + between
  })
  return { msgs, delaysMs }
}

/** وصف ساعات الرد الطبيعية — زيزو مش بيرد 3 الفجر زي البوت */
export function isHumanHours(now = new Date()): boolean {
  // توقيت القاهرة التقريبي عبر UTC+2 — يكفي لغرض "مين يرد دلوقتي"
  const h = (now.getUTCHours() + 2) % 24
  return h >= 9 && h <= 23
}
