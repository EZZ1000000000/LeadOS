// LeadOS — Jina Reader كطبقة fallback للقراءة العامة (طلب §15) + مراقبة كاملة (طلب §29)
// التدفق: Browser/public fetch → محتوى غير كافٍ → Jina Reader → نص نظيف → التصنيف/البحث
// حدود آمنة: لا تسجيل دخول عبر Jina، لا تجاوز CAPTCHA/MFA/access controls —
// لو الصفحة محمية → NEEDS_SESSION وكمّل. Jina مجرد قارئ عام للمحتوى المتاح للعامة.
import { recordJinaMetric } from "@/lib/browser/jina-metrics"
export interface ReadResult {
  ok: boolean
  status: "OK" | "NEEDS_SESSION" | "BLOCKED" | "ERROR"
  text: string
  via: "direct" | "jina" | null
  note?: string
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

/** علامات جدار تسجيل الدخول — وجودها يعني: هذا المحتوى يحتاج جلسة، ولا نحاول تجاوزه */
const LOGIN_WALL_MARKERS = [
  "log in to continue", "sign in to continue", "login_required", "please log in",
  "تسجيل الدخول مطلوب", "سجل الدخول للمتابعة", "authwall", "checkpoint",
  "verify you are human", "are you a robot", "captcha", "access denied",
]

function looksLikeLoginWall(text: string): boolean {
  const head = text.slice(0, 3000).toLowerCase()
  return LOGIN_WALL_MARKERS.some((m) => head.includes(m))
}

/** الجلب المباشر — بدون أي جلسة */
async function directFetch(url: string, timeoutMs = 12000): Promise<{ status: number; html: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "ar,en;q=0.8", Accept: "text/html,application/xhtml+xml,*/*" },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  })
  const html = (await res.text()).slice(0, 400_000)
  return { status: res.status, html }
}

/** Jina Reader — قارئ عام مجاني (r.jina.ai) — يدعم مفتاح اختياري لرفع الكوتة — مع قياس كامل (§29) */
async function jinaFetch(url: string, timeoutMs = 20000): Promise<string> {
  const started = Date.now()
  const key = process.env.JINA_API_KEY
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        // r.jina.ai يرجع Markdown نظيف — مفتاح اختياري فقط، غيابه لا يفشل النظام
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        "User-Agent": UA,
        Accept: "text/plain",
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) {
      void recordJinaMetric({ ok: false, latencyMs: Date.now() - started, error: `jina HTTP ${res.status}` })
      throw new Error(`jina HTTP ${res.status}`)
    }
    const text = (await res.text()).slice(0, 300_000)
    void recordJinaMetric({ ok: true, latencyMs: Date.now() - started })
    return text
  } catch (err) {
    const isTimeout = err instanceof Error && /timeout|abort/i.test(err.name + err.message)
    void recordJinaMetric({ ok: false, latencyMs: Date.now() - started, timeout: isTimeout, error: err instanceof Error ? err.message.slice(0, 200) : "فشل" })
    throw err
  }
}

/**
 * القارئ الموحّد: مباشر → Jina → (جدار دخول؟) NEEDS_SESSION.
 * مستخدم في: crawl_page/deep_crawl للأيجنت، والبحث العميق، وأي قراءة صفحة عامة.
 */
export async function fetchReadable(url: string, opts?: { minChars?: number; directTimeoutMs?: number }): Promise<ReadResult> {
  const minChars = opts?.minChars ?? 600
  // 1) الجلب المباشر
  try {
    const { status, html } = await directFetch(url, opts?.directTimeoutMs)
    if (status === 200 && html.trim().length >= minChars && !looksLikeLoginWall(html)) {
      return { ok: true, status: "OK", text: html, via: "direct" }
    }
    if (looksLikeLoginWall(html)) {
      // الصفحة عامة الشكل لكن محتواها خلف جدار — جرّب Jina كقارئ عام قبل الاستسلام
      try {
        const md = await jinaFetch(url)
        if (md.trim().length >= minChars && !looksLikeLoginWall(md)) return { ok: true, status: "OK", text: md, via: "jina" }
      } catch { /* Jina فشل — كمل آمنًا */ }
      return { ok: false, status: "NEEDS_SESSION", text: "", via: null, note: "الصفحة خلف جدار تسجيل دخول — تحتاج جلسة صالحة" }
    }
  } catch (err) {
    // الشبكة/البروتوكول — نكمل لـ Jina
    void err
  }

  // 2) Jina Reader fallback (محتوى عام فقط)
  try {
    const md = await jinaFetch(url)
    if (looksLikeLoginWall(md)) {
      return { ok: false, status: "NEEDS_SESSION", text: "", via: null, note: "الصفحة تحتاج تسجيل دخول — Jina لا يتجاوز الحماية" }
    }
    if (md.trim().length >= Math.min(minChars, 200)) {
      return { ok: true, status: "OK", text: md, via: "jina" }
    }
    return { ok: false, status: "ERROR", text: "", via: null, note: "المحتوى غير كافٍ حتى عبر Jina" }
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 120) : "فشل"
    return { ok: false, status: "ERROR", text: "", via: null, note: `فشل الجلب المباشر وJina: ${msg}` }
  }
}
