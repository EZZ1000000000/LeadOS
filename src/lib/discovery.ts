// LeadOS — Discovery Layer (doc §6, §7, §9) — REAL DATA ONLY
// Every adapter searches the live web through a multi-provider chain
// (Serper → Tavily → SerpAPI → Exa → z-ai fallback) with platform-targeted
// `site:` operators, or Google Places when GOOGLE_MAPS_API_KEY is present.
// No sample/mock generators: if a platform returns nothing, it returns nothing.
import type { Prisma } from "@prisma/client"
import { asArray } from "@/lib/constants"

export interface DiscoveredItem {
  externalId: string
  title: string
  body: string
  url: string
  authorName?: string
  authorHandle?: string
  publishedAt?: Date
  contentType: string
  language: string
  rawData?: Prisma.InputJsonValue
}

export interface SearchPlan {
  goal: string
  queries: string[]
  sources: string[]
  freshness_days: number
  min_score: number
  language: string[]
}

// ---- Search Planner (doc §7): query expansion ----
export function buildSearchPlan(rule: {
  name: string
  cities?: unknown
  industries?: unknown
  services?: unknown
  keywords?: unknown
  countries?: unknown
}): SearchPlan {
  const cities = asArray(rule.cities)
  const industries = asArray(rule.industries)
  const services = asArray(rule.services)
  const keywords = asArray(rule.keywords)

  const templates = [
    (c: string, i: string, s: string) => `${c} ${i} محتاج ${s}`,
    (c: string, i: string, s: string) => `${c} ${i} عايز ${s}`,
    (c: string, i: string, s: string) => `${c} ${i} looking for ${s}`,
    (c: string, i: string, s: string) => `حد يعرف مبرمج ${s} في ${c} ${i}`,
    (c: string, i: string, s: string) => `${c} ${i} ترشيح شركة ${s}`,
  ]
  const cityList = cities.length ? cities : ["Cairo", "Giza", "Alexandria"]
  const industryList = industries.length ? industries : [""]
  const serviceList = services.length ? services : ["برمجة", "website", "تطبيق"]
  const queries: string[] = []
  for (const c of cityList) {
    for (const i of industryList) {
      for (const s of serviceList) {
        queries.push(templates[queries.length % templates.length](c, i, s))
      }
    }
  }
  for (const k of keywords) queries.push(k)
  if (!queries.length) queries.push(rule.name)
  return {
    goal: rule.name,
    queries: queries.slice(0, 6),
    sources: ["web", "social", "business"],
    freshness_days: 14,
    min_score: 50,
    language: ["ar", "en"],
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// --- Serper Places (خرائط جوجل بدون GOOGLE_MAPS_API_KEY — من gemان Serper نفسه) ---
export interface PlaceResult {
  title: string
  address?: string
  phone?: string
  website?: string
  rating?: number
  ratingCount?: number
  category?: string
  placeId?: string
  cid?: string
}

export async function placesSerper(query: string, limit = 10): Promise<PlaceResult[]> {
  const key = process.env.SERPER_API_KEY
  if (!key) throw new Error("no key")
  const data = (await fetchJson("https://google.serper.dev/places", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, gl: "eg", hl: "ar", location: "Egypt" }),
  })) as {
    places?: Array<{
      title?: string; address?: string; phoneNumber?: string; website?: string
      rating?: number; ratingCount?: number; type?: string; placeId?: string; cid?: string
    }>
  }
  return (data.places ?? [])
    .filter((p) => p.title)
    .slice(0, limit)
    .map((p) => ({
      title: p.title!,
      address: p.address,
      phone: p.phoneNumber,
      website: p.website,
      rating: p.rating,
      ratingCount: p.ratingCount,
      category: p.type,
      placeId: p.placeId,
      cid: p.cid,
    }))
}

function hashId(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

/**
 * Parse search-engine date strings safely — providers return relative text
 * ("3 days ago", "منذ 3 أيام", "yesterday") that `new Date()` cannot parse,
 * producing InvalidDate and crashing ingestion. Returns undefined when unknown.
 */
export function parseSearchDate(s?: string | null): Date | undefined {
  if (!s || typeof s !== "string") return undefined
  const direct = new Date(s)
  if (!Number.isNaN(direct.getTime())) return direct
  const rel = s.match(/(\d+)\s*(دقيقة|دقائق|ساعة|ساعات|يوم|أيام|ايام|أسبوع|اسبوع|أسابيع|اسابيع|شهر|أشهر|minute|hour|day|week|month)s?/i)
    ?? s.match(/(منذ|قبل)\s*(\d+)/)
  const n = rel ? parseInt(rel[2] ?? rel[1], 10) : NaN
  if (!Number.isNaN(n)) {
    const unit = (rel?.[0] ?? "").toLowerCase()
    const ms = /دقيقة|minute/.test(unit) ? 60e3
      : /ساعة|hour/.test(unit) ? 3600e3
      : /أسبوع|اسبوع|أسابيع|اسابيع|week/.test(unit) ? 7 * 864e5
      : /شهر|أشهر|month/.test(unit) ? 30 * 864e5
      : 864e5
    return new Date(Date.now() - n * ms)
  }
  if (/أمس|امس|yesterday/i.test(s)) return new Date(Date.now() - 864e5)
  if (/اليوم|today|الآن|الان|just now|hours? ago|ساعة|ساعات/i.test(s)) return new Date(Date.now() - 2 * 3600e3)
  return undefined
}

// ---- Core: multi-provider live web search ----
// Chain: Serper (أقوى — Google SERP) → Tavily → SerpAPI → Exa → z-ai (مدمج)
// كل مزود له مفتاح في البيئة؛ أول فشل يتنقل تلقائيًا للمزود التالي، والمزود الشغال بيفضل مفضّل (sticky).
interface WebSearchResult {
  url: string
  name: string
  snippet: string
  host_name: string
  date?: string
  rank?: number
}

type SearchProvider = "serper" | "tavily" | "serpapi" | "exa" | "searxng" | "zai"

let preferredProvider: SearchProvider | null = null

export async function agentWebSearch(query: string, limit = 8, recencyDays = 30): Promise<{ results: WebSearchResult[]; provider: string }> {
  return rawWebSearch(query, limit, recencyDays)
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function googleTimeFilter(recencyDays: number): string | undefined {
  if (recencyDays <= 1) return "qdr:d"
  if (recencyDays <= 7) return "qdr:w"
  if (recencyDays <= 31) return "qdr:m"
  return undefined
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 15000): Promise<unknown> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// --- Serper (google.serper.dev — أعلى جودة وأرخص فشل) ---
async function searchSerper(query: string, limit: number, recencyDays: number): Promise<WebSearchResult[]> {
  const key = process.env.SERPER_API_KEY
  if (!key) throw new Error("no key")
  const tbs = googleTimeFilter(recencyDays)
  const data = (await fetchJson("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: Math.min(limit, 20), gl: "eg", hl: "ar", ...(tbs ? { tbs } : {}) }),
  })) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string; date?: string; position?: number }>
  }
  return (data.organic ?? [])
    .filter((r) => r.link)
    .map((r) => ({
      url: r.link!,
      name: r.title ?? "",
      snippet: r.snippet ?? "",
      host_name: hostnameOf(r.link!),
      date: r.date,
      rank: r.position,
    }))
}

// --- Tavily ---
async function searchTavily(query: string, limit: number, recencyDays: number): Promise<WebSearchResult[]> {
  const key = process.env.TAVILY_API_KEY
  if (!key) throw new Error("no key")
  const data = (await fetchJson("https://api.tavily.com/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      max_results: Math.min(limit, 15),
      search_depth: "basic",
      include_answer: false,
      ...(recencyDays <= 90 ? { days: Math.max(1, recencyDays) } : {}),
    }),
  })) as {
    results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }>
  }
  return (data.results ?? [])
    .filter((r) => r.url)
    .map((r, i) => ({
      url: r.url!,
      name: r.title ?? "",
      snippet: r.content ?? "",
      host_name: hostnameOf(r.url!),
      date: r.published_date,
      rank: i + 1,
    }))
}

// --- SerpAPI ---
async function searchSerpApi(query: string, limit: number, recencyDays: number): Promise<WebSearchResult[]> {
  const key = process.env.SERPAPI_API_KEY
  if (!key) throw new Error("no key")
  const tbs = googleTimeFilter(recencyDays)
  const params = new URLSearchParams({ engine: "google", q: query, num: String(Math.min(limit, 20)), gl: "eg", hl: "ar", api_key: key })
  if (tbs) params.set("tbs", tbs)
  const data = (await fetchJson(`https://serpapi.com/search.json?${params.toString()}`, { method: "GET" })) as {
    organic_results?: Array<{ title?: string; link?: string; snippet?: string; date?: string; position?: number }>
  }
  return (data.organic_results ?? [])
    .filter((r) => r.link)
    .map((r) => ({
      url: r.link!,
      name: r.title ?? "",
      snippet: r.snippet ?? "",
      host_name: hostnameOf(r.link!),
      date: r.date,
      rank: r.position,
    }))
}

// --- Exa ---
async function searchExa(query: string, limit: number): Promise<WebSearchResult[]> {
  const key = process.env.EXA_API_KEY
  if (!key) throw new Error("no key")
  const data = (await fetchJson("https://api.exa.ai/search", {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      numResults: Math.min(limit, 10),
      type: "auto",
      contents: { text: { maxCharacters: 300 } },
    }),
  })) as {
    results?: Array<{ title?: string; url?: string; text?: string; publishedDate?: string }>
  }
  return (data.results ?? [])
    .filter((r) => r.url)
    .map((r, i) => ({
      url: r.url!,
      name: r.title ?? "",
      snippet: r.text ?? "",
      host_name: hostnameOf(r.url!),
      date: r.publishedDate,
      rank: i + 1,
    }))
}

// --- z-ai المدمج (احتياطي أخير) ---
async function searchZai(query: string, limit: number, recencyDays: number): Promise<WebSearchResult[]> {
  const { default: ZAI } = await import("z-ai-web-dev-sdk")
  const zai = await ZAI.create()
  const delays = [0, 2000, 5000]
  let lastErr: unknown
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt]) await sleep(delays[attempt])
    try {
      const results = (await zai.functions.invoke("web_search", {
        query,
        num: limit,
        recency_days: recencyDays,
      })) as WebSearchResult[]
      return Array.isArray(results) ? results : []
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("zai failed")
}

// --- SearXNG (ميتا-بحث مفتوح المصدر self-hosted — مجاني وغير محدود) ---
async function searchSearx(query: string, limit: number, recencyDays: number): Promise<WebSearchResult[]> {
  const base = process.env.SEARXNG_URL
  if (!base) throw new Error("no searxng url")
  const params = new URLSearchParams({
    q: query, format: "json", language: "ar-EG", safesearch: "1",
    ...(recencyDays <= 7 ? { time_range: "week" } : recencyDays <= 31 ? { time_range: "month" } : {}),
  })
  const data = (await fetchJson(`${base.replace(/\/$/, "")}/search?${params.toString()}`, {
    method: "GET",
    headers: { "X-Forwarded-For": "127.0.0.1" },
  })) as {
    results?: Array<{ title?: string; url?: string; content?: string; publishedDate?: string }>
  }
  return (data.results ?? [])
    .filter((r) => r.url)
    .slice(0, limit)
    .map((r, i) => ({
      url: r.url!,
      name: r.title ?? "",
      snippet: r.content ?? "",
      host_name: hostnameOf(r.url!),
      date: r.publishedDate,
      rank: i + 1,
    }))
}

const PROVIDER_ORDER: Array<{ name: SearchProvider; run: (q: string, l: number, r: number) => Promise<WebSearchResult[]> }> = [
  { name: "serper", run: searchSerper },
  { name: "tavily", run: searchTavily },
  { name: "serpapi", run: searchSerpApi },
  { name: "exa", run: (q, l) => searchExa(q, l) },
  { name: "searxng", run: searchSearx },
  { name: "zai", run: searchZai },
]

async function rawWebSearch(query: string, limit: number, recencyDays: number): Promise<{ results: WebSearchResult[]; provider: SearchProvider | "none" }> {
  const chain = preferredProvider
    ? [PROVIDER_ORDER.find((p) => p.name === preferredProvider)!, ...PROVIDER_ORDER.filter((p) => p.name !== preferredProvider)]
    : PROVIDER_ORDER
  for (const provider of chain) {
    try {
      const results = await provider.run(query, limit, recencyDays)
      preferredProvider = provider.name
      return { results, provider: provider.name }
    } catch (err) {
      console.warn(`[discovery] provider ${provider.name} failed: "${query.slice(0, 50)}" — ${err instanceof Error ? err.message.slice(0, 100) : err}`)
    }
  }
  console.warn(`[discovery] كل المزودين فشلوا: "${query.slice(0, 60)}"`)
  return { results: [], provider: "none" }
}

function toItem(
  r: WebSearchResult,
  opts: { contentType: string; platform: string; query: string; recencyDays: number; provider?: string },
): DiscoveredItem {
  return {
    externalId: `ws:${hashId(r.url)}`,
    title: r.name,
    body: r.snippet,
    url: r.url,
    contentType: opts.contentType,
    language: /[\u0600-\u06FF]/.test(`${r.name} ${r.snippet}`) ? "ar" : "en",
    publishedAt: parseSearchDate(r.date),
    rawData: {
      host: r.host_name,
      rank: r.rank ?? 0,
      query: opts.query,
      platform: opts.platform,
      adapter: "live_web",
      provider: opts.provider ?? "zai",
      freshnessDays: opts.recencyDays,
    } as Prisma.InputJsonValue,
  }
}

/** Content type inferred from the result URL (posts vs profiles vs videos vs pages). */
function socialContentType(url: string): string {
  const u = url.toLowerCase()
  if (u.includes("facebook.com/groups") || u.includes("/posts/") || u.includes("/status/")) return "POST"
  if (u.includes("reddit.com/r/")) return "POST"
  if (u.includes("linkedin.com/posts") || u.includes("linkedin.com/pulse")) return "POST"
  if (u.includes("youtube.com/watch") || u.includes("youtu.be") || u.includes("tiktok.com")) return "VIDEO"
  if (u.includes("instagram.com") || u.includes("tiktok.com")) return "POST"
  if (u.includes("linkedin.com/in/")) return "PROFILE"
  if (u.includes("facebook.com/")) return "PAGE"
  return "SEARCH_RESULT"
}

// ---- Platform adapter: live search restricted to a platform's domains ----
const PLATFORM_SITES: Record<string, string[]> = {
  FACEBOOK: ["facebook.com"],
  INSTAGRAM: ["instagram.com"],
  X: ["x.com", "twitter.com"],
  LINKEDIN: ["linkedin.com"],
  REDDIT: ["reddit.com"],
  TIKTOK: ["tiktok.com"],
  YOUTUBE: ["youtube.com"],
  DIRECTORY: ["yellowpages.com.eg", "egypt-business.com", "egyptianfoods.com", "elwakf.com"],
  JOBS: ["wuzzuf.net", "forasna.com", "linkedin.com/jobs"],
}

async function platformAdapter(platform: string, query: string, limit: number, recencyDays: number): Promise<DiscoveredItem[]> {
  const sites = PLATFORM_SITES[platform]
  if (!sites) return []
  const siteQuery = sites.map((s) => `site:${s}`).join(" OR ")
  const geo = /[\u0600-\u06FF]/.test(query) ? "مصر" : "Egypt"
  const pinned = query.includes("Egypt") || query.includes("مصر") ? query : `${query} ${geo}`
  const fullQuery = `(${siteQuery}) ${pinned}`
  const { results, provider } = await rawWebSearch(fullQuery, limit, recencyDays)
  return results.map((r) => toItem(r, { contentType: socialContentType(r.url), platform, query, recencyDays, provider }))
}

// ---- Plain web adapter (GOOGLE_SEARCH / WEBSITE / NEWS / fallback) ----
async function webAdapter(query: string, limit: number, recencyDays: number, news = false): Promise<DiscoveredItem[]> {
  // Geo-focus: "Cairo" matches Egypt *and* Georgia (USA) — pin Egyptian intent explicitly
  const geo = /[\u0600-\u06FF]/.test(query) ? "مصر" : "Egypt"
  const pinned = query.includes("Egypt") || query.includes("مصر") ? query : `${query} ${geo}`
  const q = news ? `أخبار ${pinned} افتتاح توسع استثمار` : pinned
  const { results, provider } = await rawWebSearch(q, limit, news ? Math.min(7, recencyDays) : recencyDays)
  return results.map((r) => {
    const item = toItem(r, { contentType: news ? "ARTICLE" : "SEARCH_RESULT", platform: news ? "NEWS" : "WEB", query, recencyDays, provider })
    return item
  })
}

// ---- Google Places adapter (activates only with GOOGLE_MAPS_API_KEY — real data or nothing) ----
async function googlePlacesAdapter(query: string, limit: number): Promise<DiscoveredItem[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return []
  try {
    const textRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`,
      { signal: AbortSignal.timeout(15000) },
    )
    const textData = (await textRes.json()) as {
      results?: Array<{
        place_id: string; name: string; formatted_address?: string; rating?: number
        user_ratings_total?: number; website?: string; formatted_phone_number?: string
        types?: string[]; geometry?: { location?: { lat: number; lng: number } }
      }>
      status?: string
    }
    if (textData.status !== "OK" || !textData.results) return []
    return textData.results.slice(0, limit).map((r) => ({
      externalId: `gmaps:${r.place_id}`,
      title: r.name,
      body: `${r.name} — ${r.formatted_address ?? ""} — تقييم ${r.rating ?? "N/A"} من ${r.user_ratings_total ?? 0} مراجعة. ${r.website ? "لديه موقع إلكتروني." : "لا يوجد موقع إلكتروني ظاهر."}`,
      url: `https://www.google.com/maps/place/?q=place_id:${r.place_id}`,
      contentType: "BUSINESS",
      language: "ar",
      rawData: {
        placeId: r.place_id, address: r.formatted_address, rating: r.rating,
        reviewCount: r.user_ratings_total, website: r.website, phone: r.formatted_phone_number,
        types: r.types, location: r.geometry?.location, platform: "GOOGLE_MAPS", adapter: "google_places",
      } as Prisma.InputJsonValue,
    }))
  } catch {
    return []
  }
}

// ---- Serper Places → DiscoveredItem (بيزنسات محلية ببيانات كاملة: تليفون/موقع/تقييم) ----
export async function placesToItems(query: string, limit = 8): Promise<DiscoveredItem[]> {
  const places = await placesSerper(query, limit)
  return places.map((p) => ({
    externalId: p.placeId ? `gmaps:${p.placeId}` : `maps:${hashId(`${p.title}|${p.address ?? ""}`)}`,
    title: p.title,
    body: `${p.title} — ${p.address ?? ""} — تقييم ${p.rating ?? "N/A"} من ${p.ratingCount ?? 0} مراجعة${p.phone ? ` — تليفون ${p.phone}` : ""}${p.website ? " — لديه موقع إلكتروني." : " — لا يوجد موقع إلكتروني (فرصة)."} ${p.category ? `التصنيف: ${p.category}.` : ""}`,
    url: p.placeId
      ? `https://www.google.com/maps/place/?q=place_id:${p.placeId}`
      : p.website ?? `https://www.google.com/maps/search/${encodeURIComponent(p.title)}`,
    contentType: "BUSINESS",
    language: /[\u0600-\u06FF]/.test(p.title) ? "ar" : "en",
    rawData: {
      placeId: p.placeId, address: p.address, rating: p.rating,
      reviewCount: p.ratingCount, website: p.website, phone: p.phone,
      category: p.category, platform: "GOOGLE_MAPS", adapter: "serper_places",
    } as never,
  }))
}

// ---- Orchestrator: run discovery for one batch of queries across requested platforms ----
export async function runDiscovery(
  sourceTypes: string[],
  queries: string[],
  limitPerQuery = 5,
): Promise<{ items: DiscoveredItem[]; adaptersUsed: string[] }> {
  const items: DiscoveredItem[] = []
  const adaptersUsed: string[] = []
  const types = [...new Set(sourceTypes.length ? sourceTypes : ["GOOGLE_SEARCH"])]
  const RECENT = 14

  const maxSearches = 6 // hard cap per job — keeps ticks inside serverless time budgets
  let searches = 0

  for (const q of queries.slice(0, 3)) {
    for (const st of types) {
      if (searches >= maxSearches || items.length >= limitPerQuery * 4) break
      let batch: DiscoveredItem[] = []
      if (st === "GOOGLE_MAPS") {
        // المسار الأساسي: Serper Places (مفتاح واحد يخدم الاثنين) — fallback: Google Places API الرسمي
        batch = await placesToItems(q, limitPerQuery).catch(() => [])
        if (!batch.length) batch = await googlePlacesAdapter(q, limitPerQuery)
        if (batch.length) adaptersUsed.push("google_places")
      } else if (PLATFORM_SITES[st]) {
        batch = await platformAdapter(st, q, limitPerQuery, RECENT)
        if (batch.length) adaptersUsed.push(`site:${st.toLowerCase()}`)
      } else if (st === "NEWS") {
        batch = await webAdapter(q, limitPerQuery, RECENT, true)
        if (batch.length) adaptersUsed.push("web_news")
      } else {
        // GOOGLE_SEARCH / WEBSITE / RSS / OTHER → plain live web
        batch = await webAdapter(q, limitPerQuery, RECENT)
        if (batch.length) adaptersUsed.push("web_search")
      }
      searches++
      items.push(...batch)
      if (searches < maxSearches) await sleep(1200) // be gentle with the upstream search API
    }
    if (searches >= maxSearches || items.length >= limitPerQuery * 4) break
  }

  // Deduplicate by externalId (URL hash) and keep all-platform coverage
  const seen = new Set<string>()
  const unique = items.filter((i) => (seen.has(i.externalId) ? false : (seen.add(i.externalId), true)))
  return { items: unique.slice(0, limitPerQuery * 4), adaptersUsed: [...new Set(adaptersUsed)] }
}
