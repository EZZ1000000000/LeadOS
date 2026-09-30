// ═══════════════════════════════════════════════════════════════════════
// serp-scrape — محرك SERP بديل بعد موت كريدت Serper (سبتمبر 2026)
// الطبقات: Bing مباشر (مجاني 0 كريدت) → ZenRows→Bing (1 كريدت/طلب، 3 مفاتيح دوران)
// Bing بيرجع لينكات حقيقية مباشرة (مش زي جوجل الجديد اللي شفّر اللينكات في /goto)
// ⚠️ مكتشف حي: من غير mkt=en-US بينج بيتحول لإيدج صيني بيتجاهل site: كله ويرجع صفحات فاضية
// المخرجات متوافقة بنيويًا مع WebSearchResult في discovery.ts
// ═══════════════════════════════════════════════════════════════════════

export interface ScrapedResult {
  url: string
  name: string
  snippet: string
  host_name: string
  date?: string
  rank?: number
  /** إعلان ممول من صفحة نتايج البحث — المعلن بيصرف فلوس الآن = إشارة AD_SPENDER */
  sponsored?: boolean
  displayedLink?: string
}

// ---------- أدوات HTML ----------
function unescapeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x0?27;|&apos;/g, "'")
    .replace(/&nbsp;|&#0?160;/g, " ")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
}

function stripTags(s: string): string {
  return unescapeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

// فك لف Bing للينكات: https://www.bing.com/ck/a?!...&u=a1<base64url> → الرابط الحقيقي
function decodeBingRedirect(href: string): string | null {
  try {
    const u = new URL(href)
    if (!/bing\.com$/.test(u.hostname) || !u.pathname.startsWith("/ck/")) return null
    const raw = u.searchParams.get("u")
    if (!raw || !raw.startsWith("a1")) return null
    const b64 = raw.slice(2).replace(/-/g, "+").replace(/_/g, "/")
    const decoded = Buffer.from(b64, "base64").toString("utf-8")
    return /^https?:\/\//.test(decoded) ? decoded : null
  } catch {
    return null
  }
}

// ---------- محلل HTML نتايج Bing ----------
// بنية b_algo: <li class="b_algo"><h2><a href="...">TITLE</a></h2><div class="b_caption"><p>SNIPPET</p></div></li>
// ⚠️ اللينكات ملفوفة في bing.com/ck/a?...&u=a1<base64url> — بنفكها لوظيفة decodeBingRedirect
// إعلانات: <li class="b_ad"> ... بنفس الروح مع علامة sponsored
export function parseBingHtml(html: string, limit: number): ScrapedResult[] {
  const out: ScrapedResult[] = []
  const seen = new Set<string>()

  const blocks = [
    ...[...html.matchAll(/<li[^>]*class="[^"]*\bb_algo\b[^"]*"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => ({ body: m[1], ad: false })),
    ...[...html.matchAll(/<li[^>]*class="[^"]*\bb_ad\b[^"]*"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => ({ body: m[1], ad: true })),
  ]

  for (const block of blocks) {
    if (out.length >= limit) break
    // نلف على كل اللينكات في البلوك — الأول غالبًا لينك جوجل/bing داخلي أو لف redirect
    let url = ""
    for (const linkM of block.body.matchAll(/<a[^>]+href="([^"]+)"/g)) {
      const raw = unescapeEntities(linkM[1])
      const decoded = decodeBingRedirect(raw)
      if (decoded) {
        url = decoded
        break
      }
      const host = hostnameOf(raw)
      if (/^https?:\/\//.test(raw) && host && !/bing\.com$|microsoft\.com$|msn\.com$|live\.com$/.test(host)) {
        url = raw
        break
      }
    }
    if (!url) continue
    const host = hostnameOf(url)
    if (!host) continue
    if (seen.has(url)) continue

    const titleM = block.body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) ?? block.body.match(/<a[^>]+href="[^"]+"[^>]*>([\s\S]*?)<\/a>/)
    const title = titleM ? stripTags(titleM[1]) : ""
    if (!title) continue

    const snipM = block.body.match(/<p[^>]*>([\s\S]*?)<\/p>/)
    const snippet = snipM ? stripTags(snipM[1]).slice(0, 400) : ""

    seen.add(url)
    out.push({
      url,
      name: title,
      snippet,
      host_name: host,
      rank: out.length + 1,
      ...(block.ad ? { sponsored: true, displayedLink: host } : {}),
    })
  }
  return out
}

// ---------- تحويل الاستعلام للهجة Bing ----------
// Bing مش بيدعم paths في site: (site:linkedin.com/in بيرجع صفر نتايج)
// الحل: site:domain/path → site:domain inurl:path — وinurl: مدعوم رسميًا في Bing
export function toBingQuery(query: string): string {
  return query.replace(/site:(\S+)/g, (full, siteVal: string) => {
    const slash = siteVal.indexOf("/")
    if (slash === -1) return full
    const domain = siteVal.slice(0, slash)
    const path = siteVal.slice(slash + 1).replace(/\/+$/, "")
    if (!domain || !path) return `site:${domain}`
    return `site:${domain} inurl:${path}`
  })
}

// ---------- Bing مباشر (0 كريدت — الطبقة الأساسية) ----------
let lastBingHit = 0

export async function searchBingDirect(query: string, limit = 10): Promise<ScrapedResult[]> {
  // مهلة اجتماعية صغيرة بين الطلبات — عشان بنج مش يحسبنا بوت ويعزم العنوان
  const gap = 1200 - (Date.now() - lastBingHit)
  if (gap > 0) await new Promise((r) => setTimeout(r, gap))
  lastBingHit = Date.now()

  const params = new URLSearchParams({ q: toBingQuery(query), count: String(Math.max(limit, 10)), mkt: "en-US" })
  const res = await fetch(`https://www.bing.com/search?${params.toString()}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Accept-Language": "ar,eg;q=0.9,en;q=0.6",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`bing HTTP ${res.status}`)
  const html = await res.text()

  // صفحة التحدي/الكابتشا أو أي صفحة فاضية → ارمي خطأ عشان السلسلة تنتقل لـ ZenRows
  // ⚠️ مهم: صفحة الـ soft-block بتاعة بنج فيها b_no — لو رجعنا [] هنا السلسلة هتعتبرها نجاح وتبوظ كل حاجة
  const challenge = /g_hmCap|CAPTCHA|challenge|b_sc_flashdiv/i.test(html)
  const results = parseBingHtml(html, limit)
  if (!results.length) throw new Error(challenge ? "bing challenge page" : "bing 0 results (soft-block or empty)")
  return results
}

// ---------- ZenRows (3 مفاتيح دوران — الطلب الأساسي على Bing = 1 كريدت فقط) ----------
// مكتشف حي: zenrows→Bing بدون js_render وبدون premium_proxy = 1 كريدت وصفحة كاملة سليمة.
// إضافة premium_proxy (10 كريدت) بتعمل صفحة فاضية، وjs_render+premium (25) برضه فاضية (إيدج روسي)!
const ZR_BASE = "https://api.zenrows.com/v1/"

function zenrowsKeys(): string[] {
  return (process.env.ZENROWS_API_KEYS ?? "")
    .split(/[\s,]+/)
    .map((k) => k.trim())
    .filter((k) => k.length >= 20)
}

// تبريد لكل مفتاح: فشل شبكة/429 → المفتاح يتشال 10 دقايق
const zrCooldownUntil = new Map<string, number>()
let zrCursor = 0

// حارس ميزانية يومية: 1000 كريدت/شهر لكل مفتاح ≈ 30/يوم لكل مفتاح (هامش أمان)
// العدّاد في الذاكرة — بيتمسح مع الـ cold start (حد أقصى تقريبي مش حصري)
const ZR_DAILY_CAP = 35
const zrDayCounter = { day: new Date().toISOString().slice(0, 10), used: 0 }

function zenrowsBudgetLeft(): number {
  const today = new Date().toISOString().slice(0, 10)
  if (zrDayCounter.day !== today) {
    zrDayCounter.day = today
    zrDayCounter.used = 0
  }
  return Math.max(0, ZR_DAILY_CAP * Math.max(1, zenrowsKeys().length) - zrDayCounter.used)
}

async function zenrowsFetch(key: string, targetUrl: string, timeoutMs: number): Promise<string> {
  const params = new URLSearchParams({ apikey: key, url: targetUrl })
  const res = await fetch(`${ZR_BASE}?${params.toString()}`, { signal: AbortSignal.timeout(timeoutMs) })
  if (res.status === 429) throw new Error("zenrows 429")
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`zenrows HTTP ${res.status} ${body.slice(0, 80)}`)
  }
  zrDayCounter.used++
  return res.text()
}

// ⏱️ تايم-أوت زنرو: بنج العادي بيرجع في 2-5 ث — 18 ث برضه كصمام أمان (كان 45 = بيقتل الـ tick)
const ZR_TIMEOUT = 18_000

export async function searchBingViaZenrows(query: string, limit = 10): Promise<ScrapedResult[]> {
  // استعلامات site: → zenrows مالوش لازمة (بينج بيتجاهل site: من سيرفرات DC ويرجع زبالة)
  // دي منطقة exa (includeDomains) وserpapi (جوجل حقيقي) — تخطي فوري بدل 45 ثانية هدرة
  if (/\bsite:\S+/.test(query)) throw new Error("zenrows skip: استعلام site: — مش مهمته")
  const keys = zenrowsKeys()
  if (!keys.length) throw new Error("no zenrows keys")
  if (zenrowsBudgetLeft() <= 0) throw new Error("zenrows الحصة اليومية خلاص — نكمل بكده بكرة")
  const now = Date.now()
  const alive = keys.filter((k) => (zrCooldownUntil.get(k) ?? 0) <= now)
  if (!alive.length) throw new Error("zenrows كل المفاتيح في تبريد")

  const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(toBingQuery(query))}&count=${Math.max(limit, 10)}&mkt=en-US`
  const zrDeadline = Date.now() + 22_000 // سقف إجمالي للاستعلام الواحد مهما عدد المفاتيح — الـtick ليه ميزانية
  let lastErr: unknown = new Error("zenrows: no attempts")

  for (let i = 0; i < alive.length; i++) {
    if (Date.now() > zrDeadline) break
    const key = alive[(zrCursor + i) % alive.length]
    try {
      const html = await zenrowsFetch(key, bingUrl, ZR_TIMEOUT)
      zrCursor = (zrCursor + i + 1) % alive.length
      const results = parseBingHtml(html, limit)
      if (results.length) return results
      // b_no حقيقي = استعلام فعلاً من غير نتايج → رجّع فاضي فورًا من غير ما نحرق كريدت بمفاتيح تانية
      if (/class="b_no"|b_noScp/i.test(html)) return []
      // غير كده صفحة تحد/زبالّة (بينج بيتجاهل site:) → برّد المفتاح وجرب اللي بعده
      zrCooldownUntil.set(key, Date.now() + 5 * 60_000)
      lastErr = new Error("zenrows bing 0 results")
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("429")) zrCooldownUntil.set(key, Date.now() + 30 * 60_000)
      else if (msg.includes("fetch failed") || msg.includes("timeout") || msg.includes("abort"))
        zrCooldownUntil.set(key, Date.now() + 10 * 60_000)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("zenrows failed")
}
