// LeadOS — Agent Toolkit (الترسانة الداخلية)
// كل أداة: { name, description, gate?, run }
// Gates: أدوات تحتاج بنية خارجية (Worker/SearXNG/Ollama/Evolution) تتعطل بأمان بـ"not configured"
// وتتفعل تلقائيًا أول ما متغير البيئة يبقى موجود — بدون تعديل كود.
import { db } from "@/lib/db"
import { agentWebSearch, placesToItems, runDiscovery, type DiscoveredItem } from "@/lib/discovery"
import { ingestDiscoveredItems } from "@/lib/queue"
import { heuristicClassify } from "@/lib/classification"
import {
  ensureStealth,
  stealthAct,
  stealthExtract,
  stealthHealth,
  stealthInjectCookieHeader,
  stealthNavigate,
} from "@/lib/agent/stealth-browser"

export interface ToolResult {
  ok: boolean
  note: string
  data?: unknown
}

export interface AgentTool {
  name: string
  description: string
  gate: "ready" | "env"
  envKeys?: string[]
  run: (args: Record<string, unknown>) => Promise<ToolResult>
}

// ═══════════ أدوات مساعدة داخلية ═══════════

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
// تليفون مصري صارم: موبايل 01[0125]xxxxxxxx أو دولي +20، أو أرضي 02/03 — وليس أرقام عشوائية أو خطوط ساخنة قصيرة
const EG_PHONE_RE = /(?:(?:\+?20\s?|0)1[0125]\s?\d{4}\s?\d{4})|(?:(?:\+?20\s?)?0?2\s?2[2-4]\s?\d{7})/g
const SOCIAL_RE = /(https?:\/\/(?:www\.)?(facebook|instagram|linkedin|tiktok|x|twitter|youtube)\.com\/[^\s"'>)]+)/gi

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}

async function fetchPage(url: string, timeoutMs = 12000): Promise<{ ok: boolean; status: number; html: string }> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        "Accept-Language": "ar,en;q=0.8",
      },
      redirect: "follow",
    })
    const html = await res.text()
    return { ok: res.ok, status: res.status, html }
  } catch {
    return { ok: false, status: 0, html: "" }
  }
}

export function extractContacts(text: string): { emails: string[]; phones: string[]; socials: string[] } {
  const emails = [...new Set((text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()))].slice(0, 5)
  const phones = [...new Set((text.match(EG_PHONE_RE) ?? []).map((p) => p.replace(/[\s-]/g, "")))]
    .filter((p) => p.replace(/\D/g, "").length >= 10 && p.replace(/\D/g, "").length <= 13)
    .slice(0, 5)
  const socials = [...new Set((text.match(SOCIAL_RE) ?? []).map((s) => s.replace(/[)\]},]$/, "")))].slice(0, 6)
  return { emails, phones, socials }
}

// ═══════════ الترسانة ═══════════

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: "web_search",
    description: "بحث ويب حي عبر سلسلة مزودين (Serper→Tavily→SerpAPI→Exa→SearXNG→z-ai) مع تثبيت جغرافي مصري",
    gate: "ready",
    run: async (args) => {
      const query = String(args.query ?? "")
      if (!query) return { ok: false, note: "استعلام مفقود" }
      const limit = Number(args.limit ?? 8)
      const recencyDays = Number(args.recency_days ?? 30)
      const { results, provider } = await agentWebSearch(query, limit, recencyDays)
      return {
        ok: results.length > 0,
        note: `«${query.slice(0, 40)}» → ${results.length} نتيجة عبر ${provider}`,
        data: results.slice(0, 10).map((r) => ({ title: r.name, url: r.url, snippet: r.snippet.slice(0, 140), provider })),
      }
    },
  },
  {
    name: "maps_places",
    description: "منجم الليدز المحلي: بيزنسات من خرائط جوجل (اسم/تليفون/موقع/تقييم/عنوان) — بيشتغل بمفتاح Serper",
    gate: "ready",
    run: async (args) => {
      const query = String(args.query ?? "")
      if (!query) return { ok: false, note: "استعلام مفقود" }
      const limit = Number(args.limit ?? 10)
      const places = await placesToItems(query, limit)
      return {
        ok: places.length > 0,
        note: `«${query.slice(0, 40)}» → ${places.length} بيزنس من الخرائط`,
        data: places.map((p) => ({
          title: p.title,
          phone: (p.rawData as { phone?: string }).phone,
          website: (p.rawData as { website?: string }).website,
          rating: (p.rawData as { rating?: number }).rating,
          reviews: (p.rawData as { reviewCount?: number }).reviewCount,
          address: (p.rawData as { address?: string }).address,
        })),
      }
    },
  },
  {
    name: "crawl_page",
    description: "عين الأيجنت: يزور صفحة ويب ويستخرج النص + الإيميلات والتليفونات وروابط السوشيال (Markdown-ready)",
    gate: "ready",
    run: async (args) => {
      const url = String(args.url ?? "")
      if (!/^https?:\/\//.test(url)) return { ok: false, note: "URL غير صالح" }
      const { ok, status, html } = await fetchPage(url)
      if (!ok || !html) return { ok: false, note: `فشل الوصول (${status || "network"})` }
      const text = htmlToText(html).slice(0, 4000)
      const contacts = extractContacts(html)
      return {
        ok: true,
        note: `تمت قراءة الصفحة (${html.length} حرف) — إيميلات ${contacts.emails.length}، تليفونات ${contacts.phones.length}`,
        data: { url, textPreview: text.slice(0, 400), ...contacts },
      }
    },
  },
  {
    name: "deep_crawl",
    description: "حصادة المواقع: يزور موقع كامل (حتى 8 صفحات داخلية) ويجمع بيانات التواصل من كل صفحة",
    gate: "ready",
    run: async (args) => {
      const startUrl = String(args.url ?? "")
      if (!/^https?:\/\//.test(startUrl)) return { ok: false, note: "URL غير صالح" }
      const maxPages = Math.min(8, Number(args.max_pages ?? 5))
      const origin = new URL(startUrl).origin
      const first = await fetchPage(startUrl)
      if (!first.ok) return { ok: false, note: "فشل الوصول للموقع" }
      // خريطة الروابط الداخلية (mini /map)
      const links = [...new Set(
        [...first.html.matchAll(/href="((?:https?:\/\/)?[^"'\s>]+)"/g)]
          .map((m) => m[1])
          .map((l) => { try { return new URL(l, origin).toString() } catch { return null } })
          .filter((l): l is string => Boolean(l) && l!.startsWith(origin) && !/\.(pdf|jpg|png|zip|mp4)$/i.test(l!)),
      )].slice(0, maxPages - 1)
      const pages: Array<{ url: string; contacts: ReturnType<typeof extractContacts> }> = []
      const allEmails = new Set<string>()
      const allPhones = new Set<string>()
      for (const url of [startUrl, ...links]) {
        const page = url === startUrl ? first : await fetchPage(url)
        if (!page.ok) continue
        const contacts = extractContacts(page.html)
        contacts.emails.forEach((e) => allEmails.add(e))
        contacts.phones.forEach((p) => allPhones.add(p))
        pages.push({ url, contacts })
        if (url !== startUrl) await new Promise((r) => setTimeout(r, 400)) // لطفًا
      }
      return {
        ok: true,
        note: `تم حصاد ${pages.length} صفحة من ${origin} — إيميلات: ${[...allEmails].slice(0, 3).join(", ") || "لا شيء"}`,
        data: { origin, pagesCrawled: pages.length, emails: [...allEmails], phones: [...allPhones] },
      }
    },
  },
  {
    name: "lead_qualify",
    description: "فلتر الجودة: يصنف نص/منشور/صفحة (نية شراء، صناعة، خدمات، سكور 0-100) بمنطق LeadOS",
    gate: "ready",
    run: async (args) => {
      const title = String(args.title ?? "")
      const body = String(args.body ?? "")
      if (!title && !body) return { ok: false, note: "نص مفقود" }
      const classification = heuristicClassify(title, body)
      return {
        ok: true,
        note: classification.is_lead
          ? `ليد صالح — نية ${classification.intent} — سكور ${classification.score} — ${classification.reason}`
          : `غير ليد — ${classification.reason}`,
        data: classification,
      }
    },
  },
  {
    name: "lead_hunt",
    description: "المحرك الكامل: استعلامات → بحث في منصات (خرائط/فيسبوك/انستجرام/لينكدإن/ويب/أخبار...) → تصنيف → تسجيل ليدز في CRM",
    gate: "ready",
    run: async (args) => {
      const wsId = String(args.workspace_id ?? "")
      const queries = (Array.isArray(args.queries) ? args.queries : [args.queries]).map(String).filter(Boolean)
      const platforms = (Array.isArray(args.platforms) ? args.platforms : ["GOOGLE_SEARCH"]).map(String)
      if (!wsId || !queries.length) return { ok: false, note: "workspace_id أو queries مفقود" }
      let created = 0, duplicates = 0, scanned = 0
      const perPlatform: Array<{ platform: string; items: number; created: number; topItems: Array<{ title: string; url: string }> }> = []
      const sourceTypeOf: Record<string, string> = { JOBS: "WEBSITE", WEB: "GOOGLE_SEARCH", NEWS: "NEWS", GOOGLE_SEARCH: "GOOGLE_SEARCH", FACEBOOK: "FACEBOOK", INSTAGRAM: "INSTAGRAM", X: "X", LINKEDIN: "LINKEDIN", REDDIT: "REDDIT", TIKTOK: "TIKTOK", YOUTUBE: "YOUTUBE", DIRECTORY: "DIRECTORY", GOOGLE_MAPS: "GOOGLE_MAPS" }
      for (const platform of platforms) {
        const source = await db.source.findFirst({ where: { workspaceId: wsId, type: sourceTypeOf[platform] ?? platform } })
        if (!source) { perPlatform.push({ platform, items: 0, created: 0, topItems: [] }); continue }
        let items: DiscoveredItem[] = []
        try {
          const res = await runDiscovery([platform], queries, 5)
          items = res.items
        } catch { /* provider fail → next */ }
        const r = await ingestDiscoveredItems(wsId, source, null, items)
        scanned += items.length
        created += r.created
        duplicates += r.duplicates
        perPlatform.push({
          platform,
          items: items.length,
          created: r.created,
          topItems: items.slice(0, 6).map((i) => ({ title: (i.title ?? "").slice(0, 80), url: i.url })),
        })
      }
      return {
        ok: true,
        note: `مَسح ${scanned} عنصر → ${created} ليد جديد (${duplicates} مكرر)`,
        data: { scanned, created, duplicates, perPlatform },
      }
    },
  },
  {
    name: "export_leads_csv",
    description: "تصدير ليدز CRM لملف Excel/CSV (اسم/تليفون/موقع/سيتي/سكور/مصدر) محفوظ في مجلد التحميلات",
    gate: "ready",
    run: async (args) => {
      const wsId = String(args.workspace_id ?? "")
      const minScore = Number(args.min_score ?? 0)
      const leads = await db.lead.findMany({
        where: { workspaceId: wsId, score: { gte: minScore } },
        include: { business: { select: { name: true, phone: true, websiteUrl: true, city: true, industry: true, rating: true } } },
        orderBy: { score: "desc" },
        take: 500,
      })
      const rows = [["name", "phone", "website", "city", "industry", "rating", "score", "source_type", "summary"]]
      for (const l of leads) {
        rows.push([
          l.business?.name ?? "", l.business?.phone ?? "", l.business?.websiteUrl ?? "",
          l.business?.city ?? "", l.business?.industry ?? "", String(l.business?.rating ?? ""),
          String(l.score), l.leadSourceType, (l.summary ?? "").replace(/[",\n]/g, " ").slice(0, 120),
        ])
      }
      const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n")
      const { mkdir, writeFile } = await import("node:fs/promises")
      const path = await import("node:path")
      const dir = process.env.EXPORT_DIR ?? "/home/z/my-project/download"
      await mkdir(dir, { recursive: true }).catch(() => undefined)
      const filename = `leados-export-${new Date().toISOString().slice(0, 10)}-${Date.now() % 100000}.csv`
      await writeFile(path.join(dir, filename), csv, "utf8")
      return {
        ok: true,
        note: `تم حفظ ${leads.length} ليد في ${filename} (سكور ≥ ${minScore})`,
        data: { filename, path: `${dir}/${filename}`, count: leads.length },
      }
    },
  },
  {
    name: "stealth_browse",
    description:
      "أيد الستيلث (Camoufox): متصفح Firefox حقيقي مضاد للبصمة يفتح أي موقع — فيسبوك/انستجرام/مواقع محمية — تصفح + استخراج عناصر + تفاعل (كليك/كتابة) + سكرين شوت + حقن كوكيز جلسة",
    gate: "env",
    envKeys: ["CAMOUFOX_URL"],
    run: async (args) => {
      const url = String(args.url ?? "")
      const action = String(args.action ?? "goto").toLowerCase()
      // الحالة فقط
      if (action === "status") {
        const h = await stealthHealth()
        return {
          ok: h.online,
          note: h.online ? `الستيلث شغال (${h.browser})` : "خدمة Camoufox غير متاحة",
          data: h,
        }
      }
      // تشغيل الخدمة تلقائيًا لو معطلة
      const ready = await ensureStealth(90_000)
      if (!ready) {
        return { ok: false, note: "خدمة Camoufox مش متاحة — محتاجة سيرفر يشتغل عليه المتصفح (محليًا بتتشغل تلقائيًا، وعلى Vercel اضبط CAMOUFOX_URL)" }
      }
      // حقن كوكيز جلسة فيسبوك لو موجودة (مرة واحدة لكل تشغيل)
      if (String(args.inject_fb_session ?? "") === "1" && process.env.FACEBOOK_SESSION_COOKIE) {
        const injected = await stealthInjectCookieHeader(process.env.FACEBOOK_SESSION_COOKIE)
        if (injected) return { ok: true, note: "تم حقن كوكيز فيسبوك في بروفايل المتصفح" }
      }
      if (action === "goto") {
        if (!/^https?:\/\//.test(url)) return { ok: false, note: "URL غير صالح" }
        const nav = await stealthNavigate({
          url,
          screenshot: Boolean(args.screenshot),
          scroll_times: Number(args.scroll_times ?? 0),
          timeout: Number(args.timeout ?? 45_000),
        })
        if (!nav.ok) return { ok: false, note: `فشل التصفح: ${nav.error}` }
        // استخراج اختياري لعناصر في نفس النداء
        const selector = String(args.selector ?? "")
        const items = selector ? (await stealthExtract({ selector, limit: Number(args.limit ?? 30) })).items : undefined
        // سكرين شوت محفوظ كملف
        let savedShot: string | undefined
        if (nav.screenshot) {
          try {
            const { mkdir, writeFile } = await import("node:fs/promises")
            const dir = "/home/z/my-project/download/stealth"
            await mkdir(dir, { recursive: true })
            const filename = `shot-${Date.now()}.png`
            await writeFile(`${dir}/${filename}`, Buffer.from(nav.screenshot, "base64"))
            savedShot = `${dir}/${filename}`
          } catch {
            /* Vercel read-only — تجاهل */
          }
        }
        return {
          ok: true,
          note: `تم فتح «${(nav.title ?? "").slice(0, 60) || url}» — ${nav.text?.length ?? 0} حرف${savedShot ? " + سكرين شوت" : ""}`,
          data: { url: nav.url, http_status: nav.http_status, title: nav.title, text: nav.text?.slice(0, 3000), extracted: items?.slice(0, 10), screenshot: savedShot },
        }
      }
      if (action === "extract") {
        const selector = String(args.selector ?? "")
        if (!selector) return { ok: false, note: "extract يحتاج selector" }
        const r = await stealthExtract({ selector, attr: String(args.attr ?? "innerText"), limit: Number(args.limit ?? 30) })
        return { ok: r.ok, note: r.ok ? `${r.count} عنصر من ${selector.slice(0, 40)}` : `فشل: ${r.error}`, data: r.items?.slice(0, 20) }
      }
      if (action === "click" || action === "type" || action === "press" || action === "scroll" || action === "eval" || action === "wait") {
        const r = await stealthAct({
          action,
          selector: String(args.selector ?? "") || undefined,
          text: String(args.text ?? "") || undefined,
          key: String(args.key ?? "") || undefined,
          script: String(args.script ?? "") || undefined,
          amount: args.amount ? Number(args.amount) : undefined,
        })
        return { ok: r.ok, note: r.ok ? r.note ?? "تم التنفيذ" : `فشل: ${r.error}`, data: r.result }
      }
      if (action === "cookies") {
        const header = String(args.cookie_header ?? "") || process.env.FACEBOOK_SESSION_COOKIE || ""
        if (!header) return { ok: false, note: "لا يوجد cookie_header ولا FACEBOOK_SESSION_COOKIE" }
        const okDone = await stealthInjectCookieHeader(header, String(args.domain ?? ".facebook.com"))
        return { ok: okDone, note: okDone ? "تم حقن الكوكيز في المتصفح" : "فشل الحقن" }
      }
      return { ok: false, note: `عملية غير معروفة: ${action} (المتاح: goto/extract/click/type/press/scroll/wait/eval/cookies/status)` }
    },
  },
  {
    name: "browser_task",
    description: "إيد الأيجنت: مهام متصفح حقيقية (فيسبوك جروبات/سكرول/كوكيز) عبر Worker Botasaurus الخارجي",
    gate: "env",
    envKeys: ["WORKER_URL"],
    run: async (args) => {
      const base = process.env.WORKER_URL
      if (!base) return { ok: false, note: "Worker غير مربوط — اضبط WORKER_URL (شوف worker/README-ar.md)" }
      const res = await fetch(`${base.replace(/\/$/, "")}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(process.env.WORKER_TOKEN ? { "x-api-key": process.env.WORKER_TOKEN } : {}) },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(15000),
      })
      const data = (await res.json().catch(() => ({}))) as { queued?: boolean }
      return { ok: res.ok, note: res.ok ? "تم إرسال المهمة للـWorker" : `فشل (${res.status})`, data }
    },
  },
  {
    name: "linkedin_hunt",
    description: "صياد اللينكدإن: بحث أعضاء/شركات/وظايف وصيد profiles عبر Worker (كوكيز لينكدإن)",
    gate: "env",
    envKeys: ["WORKER_URL"],
    run: async (args) => {
      const base = process.env.WORKER_URL
      if (!base) return { ok: false, note: "Worker غير مربوط — اضبط WORKER_URL" }
      const res = await fetch(`${base.replace(/\/$/, "")}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(process.env.WORKER_TOKEN ? { "x-api-key": process.env.WORKER_TOKEN } : {}) },
        body: JSON.stringify({ task: "linkedin", ...(args as object) }),
        signal: AbortSignal.timeout(15000),
      })
      return { ok: res.ok, note: res.ok ? "مهمة لينكدإن في الطريق" : `فشل (${res.status})` }
    },
  },
  {
    name: "whatsapp_send",
    description: "بوق التواصل: إرسال واتساب مخصص لليد عبر Evolution API (self-hosted)",
    gate: "env",
    envKeys: ["EVOLUTION_API_URL", "EVOLUTION_API_KEY"],
    run: async (args) => {
      const base = process.env.EVOLUTION_API_URL
      const key = process.env.EVOLUTION_API_KEY
      if (!base || !key) return { ok: false, note: "Evolution API غير مربوطة — اضبط EVOLUTION_API_URL وEVOLUTION_API_KEY" }
      const instance = process.env.EVOLUTION_INSTANCE ?? "leados"
      const to = String(args.phone ?? "").replace(/[^\d]/g, "")
      const message = String(args.message ?? "")
      if (!to || !message) return { ok: false, note: "تليفون أو رسالة مفقودة" }
      const res = await fetch(`${base.replace(/\/$/, "")}/message/sendText/${instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: key },
        body: JSON.stringify({ number: `${to}@s.whatsapp.net`, text: message }),
        signal: AbortSignal.timeout(15000),
      })
      return { ok: res.ok, note: res.ok ? "تم إرسال الواتساب ✅" : `فشل الإرسال (${res.status})` }
    },
  },
  {
    name: "local_llm_status",
    description: "المخ المحلي: فحص Ollama (LLM محلي صفر تكلفة) وتوافره للتفكير والتحليل",
    gate: "env",
    envKeys: ["OLLAMA_BASE_URL"],
    run: async () => {
      const base = process.env.OLLAMA_BASE_URL
      if (!base) return { ok: false, note: "Ollama غير مربوط — اضبط OLLAMA_BASE_URL (مثلاً http://localhost:11434)" }
      try {
        const res = await fetch(`${base.replace(/\/$/, "")}/api/tags`, { signal: AbortSignal.timeout(5000) })
        const data = (await res.json()) as { models?: Array<{ name: string }> }
        return { ok: res.ok, note: res.ok ? `Ollama شغال — ${data.models?.length ?? 0} موديل محلي` : "Ollama لا يستجيب", data }
      } catch {
        return { ok: false, note: "Ollama غير قابل للوصول" }
      }
    },
  },
]

export function toolStatus() {
  return AGENT_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    ready: t.gate === "ready" || (t.envKeys ?? []).every((k) => Boolean(process.env[k])),
    needs: t.gate === "env" ? (t.envKeys ?? []) : [],
  }))
}
