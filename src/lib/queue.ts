// LeadOS — DB-backed Job Queue + Orchestrator (doc §8, §52)
// Replaces Redis/Celery for the free-tier deployment: the Job table IS the queue.
// A cron ping hits /api/cron/tick which calls processTick() — idempotent, batched.
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { asArray } from "@/lib/constants"
import { buildSearchPlan, runDiscovery, expandSourceTypes, type DiscoveredItem } from "@/lib/discovery"
import { classifyContent } from "@/lib/classification"
import { findDuplicateLead, normalizePhone } from "@/lib/dedup"
import { recomputeLeadScore } from "@/lib/scoring"
import { runDeepResearch } from "@/lib/research"
import { enrollLead, processDueEnrollments, reactivationSweep } from "@/lib/sequences"
import { PLATFORM_SITES } from "@/lib/discovery"

const WORKER_ID = `worker-${process.pid}-${Math.random().toString(36).slice(2, 7)}`

export async function enqueueJob(
  workspaceId: string,
  type: string,
  payload: Prisma.InputJsonValue,
  priority = 50,
  scheduledAt?: Date,
) {
  return db.job.create({
    data: { workspaceId, type: type as never, payload, priority, scheduledAt: scheduledAt ?? new Date() },
  })
}

/** Claim up to N queued jobs (atomic-ish: lock via lockedAt + status). */
async function claimJobs(limit: number) {
  const jobs = await db.job.findMany({
    where: {
      status: { in: ["QUEUED", "RETRYING"] },
      scheduledAt: { lte: new Date() },
    },
    orderBy: [{ priority: "desc" }, { scheduledAt: "asc" }],
    take: limit,
  })
  const claimed: string[] = []
  for (const job of jobs) {
    const updated = await db.job.updateMany({
      where: { id: job.id, status: { in: ["QUEUED", "RETRYING"] } },
      data: { status: "RUNNING", startedAt: new Date(), lockedAt: new Date(), workerId: WORKER_ID, attempts: { increment: 1 } },
    })
    if (updated.count > 0) claimed.push(job.id)
  }
  if (!claimed.length) return []
  return db.job.findMany({ where: { id: { in: claimed } } })
}

interface DiscoveryPayload {
  ruleId?: string
  sourceId?: string
  query?: string
  sourceTypes?: string[]
  fullSweep?: boolean // مسح شامل: كل المنصات في جوبة واحدة — لبذر الـ16 مصدر فورًا
}

/** Process one DISCOVERY job: search → normalize → dedup → classify → score → maybe research. */
async function processDiscoveryJob(jobId: string): Promise<string> {
  const job = await db.job.findUnique({ where: { id: jobId } })
  if (!job) return "job missing"
  const wsId = job.workspaceId
  const payload = (job.payload ?? {}) as DiscoveryPayload

  let rule: { id: string; name: string; cities: unknown; industries: unknown; services: unknown; keywords: unknown; countries: unknown; sourceTypes: unknown; startResearch: boolean; researchDepth: string; minLeadScore: number; workspaceId: string; priority: number } | null = null
  if (payload.ruleId) {
    rule = await db.searchRule.findUnique({ where: { id: payload.ruleId } })
  }
  const plan = rule
    ? buildSearchPlan(rule)
    : { queries: [payload.query ?? "عملاء محتاجين خدمات برمجية في مصر"], sources: ["web"], freshness_days: 14, min_score: 50, goal: "ad-hoc", language: ["ar", "en"] }

  // موجة المنصات الكاملة: الأنواع المسجلة + دوران بالساعة على باقي المنصات المبنية (شغّل باقي المصادر)
  // fullSweep: كل المنصات مرة واحدة — بذرة فورية للـ16 مصدر
  const declared = payload.sourceTypes ?? asArray(rule?.sourceTypes)
  const sourceTypes = expandSourceTypes(declared, { all: Boolean(payload.fullSweep) })
  // سرقة العملاء من المنافسين: لو في منافسين مسجلين، استعلامات «بديل/توصية + المنافس» بتتقدم الأول
  // — اللي بيسأل عن بديل منافس = عميل جاهز للتحويل حالًا
  let queries = plan.queries
  try {
    const comps = await db.competitor.findMany({
      where: { competitor: { workspaceId: wsId } },
      include: { competitor: { select: { name: true } } },
      take: 4,
    })
    const names = [...new Set(comps.map((c) => c.competitor?.name?.trim()).filter(Boolean))] as string[]
    if (names.length) {
      const poach = names.slice(0, 2).map((n) => `بديل ${n} توصية`) as string[]
      queries = [...poach, ...queries]
    }
  } catch { /* بدون منافسين — البحث العادي */ }
  const { items, adaptersUsed } = await runDiscovery(
    sourceTypes,
    queries,
    payload.fullSweep ? 10 : 4, // المسح الشامل محتاج مساحة أكبر عشان كل منصة تاخد نصيبها
    payload.fullSweep ? { maxSearches: 18, passes: 1 } : undefined,
  )

  // Persist a SearchJob record for observability
  const source = payload.sourceId
    ? await db.source.findUnique({ where: { id: payload.sourceId } })
    : (await db.source.findFirst({ where: { workspaceId: wsId, status: "ACTIVE" } }))
  if (source) {
    await db.searchJob.create({
      data: {
        sourceId: source.id,
        searchRuleId: rule?.id,
        query: plan.queries[0],
        status: "SUCCESS",
        startedAt: new Date(Date.now() - 60000),
        completedAt: new Date(),
        resultCount: items.length,
        metadata: { adaptersUsed, plan: plan.queries },
      },
    })
    await db.source.update({ where: { id: source.id }, data: { lastRunAt: new Date(), lastError: null } })
  }

  const { created, duplicates } = source
    ? await ingestDiscoveredItems(wsId, source, rule, items)
    : { created: 0, duplicates: 0 }
  return `discovered=${items.length} leadsCreated=${created} duplicates=${duplicates} adapters=${adaptersUsed.join(",") || "none"}`
}

export interface IngestRuleLite {
  id?: string
  startResearch?: boolean
  researchDepth?: string
}

// Noise patterns: scraped SERP titles / aggregator pages / clickbait ads — never businesses
const NOISE_PATTERNS: RegExp[] = [
  /^title\s+/i, // scraper artifact prefix
  /^(real\s+)?(estate\s+)?jobs?\s+in\s+.{3,60}(governorate|egypt|cairo|giza|alexandria)/i, // job aggregator listings
  /^(وظائف|وظيفة)\s+.{0,40}(مصر|القاهرة|الجيزة|الاسكندرية)/, // Arabic job aggregators
  /^(\s*#\w+\s*)+$/, // hashtag-only names
  /^https?:\/\/\S+$|^www\.\S+$|^\S+\.(com|net|org|eg|io)(\/\S*)?$/i, // URL as business name
  /^(try|swipe|check out|download now|subscribe|follow us|limited offer)\b/i, // clickbait
  /^(أفضل|افضل)\s*\d+\s|^best\s+\d+\s/i, // directory listicles "أفضل 302 دكتور..." — category pages, not businesses
  // عقارات وإيجارات من مجموعات فيسبوك — مش بيزنسات
  /^(شقه|شقة|غرفه|غرفة|استوديو|فيله|فيلا|أرض|ارض)\s/u,
  /^(محتاج|محتاجة|عايز|عاوز|مطلوب)\s+(شقه|شقة|غرفه|غرفة|استوديو)/u,
  /(للإيجار|للايجار|إيجار يومي|ايجار يومي|شقه مفروشه|شقة مفروشه|غرفه مفروشه|غرفة مفروشه)/u,
  // لاحقات نتائج البحث لصفحات شخصية: "فلان - LinkedIn" إلخ
  /\s[-–—]\s*(Facebook|LinkedIn|Instagram|YouTube|Twitter|X)\s*$/iu,
  // قواميس/ترجمة/ويكي وصفحات تعريفية — مش بيزنسات
  /cambridge|dictionary|wikipedia|wiktionary|reverso|traduction|المعنى|معنى\s*كلمة|قاموس/i,
  /^(what is|what's)\s+(this|the|a|an)\b/i, // أسئلة تعريفية عامة
]

/** Clean a SERP title into a usable business name (strip truncation artifacts). */
function cleanName(raw: string): string {
  return raw
    .replace(/[\u200E\u200F\u202A-\u202E]/g, "") // علامات اتجاه النص من نتائج SERP
    .replace(/^(title\s+)+/i, "")
    .replace(/\s*[-–—|]\s*(Facebook|LinkedIn|Instagram|YouTube|Twitter|X)\s*$/i, "")
    .replace(/\s*(\.\.\.|…)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Derive a clean business name from a social-platform profile URL handle. */
function socialHandleName(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, "")
    const seg = u.pathname.split("/").filter(Boolean)
    if (!seg.length) return null
    // instagram.com/<brand> | tiktok.com/@<brand> | x.com/<handle> | youtube.com/@<channel>
    if (/(^|\.)instagram\.com$|(^|\.)tiktok\.com$|(^|\.)(x|twitter)\.com$|(^|\.)youtube\.com$/.test(host)) {
      let name = seg[0].replace(/^@/, "")
      if (/^(p|reel|reels|watch|shorts|video|status|explore)$/i.test(name)) return null
      if (seg[0] === "c" && seg[1]) name = seg[1] // facebook.com/c/<name>
      if (name.length < 3 || /^\d+$/.test(name)) return null
      return name.replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    }
    // facebook.com/pages/<Name>/<id> or facebook.com/<PageName> (not groups/profile)
    if (/(^|\.)facebook\.com$/.test(host)) {
      if (seg[0] === "pages" && seg[1]) return seg[1].replace(/[-_]+/g, " ")
      if (["groups", "profile.php", "people", "share", "story", "watch", "photo", "permalink", "hashtag"].includes(seg[0])) return null
      if (seg[0] && !/^\d+$/.test(seg[0]) && seg[0].length >= 3) return seg[0].replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      return null
    }
    // linkedin.com/company/<name>
    if (/(^|\.)linkedin\.com$/.test(host) && seg[0] === "company" && seg[1]) {
      return seg[1].replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    }
    return null
  } catch {
    return null
  }
}

/**
 * Shared ingestion pipeline used by BOTH the internal DISCOVERY jobs and the
 * external webhook (/api/ingest/webhook — e.g. the Botasaurus worker).
 * Normalizes items → ContentItems → classify → dedup → Business/Lead → score → research.
 */
export async function ingestDiscoveredItems(
  wsId: string,
  source: { id: string; type: string; name: string },
  rule: IngestRuleLite | null,
  items: DiscoveredItem[],
): Promise<{ created: number; duplicates: number }> {
  let leadsCreated = 0
  let duplicates = 0
  for (const item of items) {
    // Quality guard: skip hashtag-only titles / empty-ish names (social noise, not businesses)
    const title = cleanName(item.title ?? "")
    if (!title || title.length < 5 || title.split(/\s+/).every((w) => w.startsWith("#"))) continue
    if (NOISE_PATTERNS.some((re) => re.test(title))) continue
    // بروفايلات لينكدإن الشخصية مش بيزنسات — الشركات بتتجمع من /company/ بس
    if (/linkedin\.com\/(in|pub)\//i.test(item.url)) continue
    // بيزنسات خرائط جوجل: قائمة استهداف مباشرة — مش شرط فيها نية شراء صريحة
    const isMapsBusiness = item.contentType === "BUSINESS" || (item.rawData as { platform?: string } | null)?.platform === "GOOGLE_MAPS"
    // JOBS platform: keep only expansion-signal roles (managers/dev/sales/marketing) —
    // generic operator/technician ads are hiring noise, not a growth lead.
    const itemPlatform = typeof (item.rawData as { platform?: string } | null)?.platform === "string"
      ? (item.rawData as { platform?: string }).platform
      : undefined
    if (itemPlatform === "JOBS" && !/مدير|manager|مبرمج|developer|مطور|مسؤول|sales|مبيعات|تسويق|marketing|محاسب|accountant|مصمم|designer|hr|موارد بشرية/i.test(title)) continue
    // تصنيف إشارة النية (أولوية الصياد): صاحب الحاجة الصريحة → اللي بيقارن بالمنافسين → اللي بيصرف إعلانات → قوائم السوق
    const hay = `${item.title ?? ""} ${item.body}`
    const intentSignal: string | null = itemPlatform === "ADS_LIBRARY"
      ? "AD_SPENDER"
      : isMapsBusiness
        ? "MARKET_LIST"
        : /محتاج|عايز|عاوز|مطلوب|أبحث|ابحث|ببحث|بحاجة|ناقص|دور علي|بيدور|need|looking for|seeking|we need/i.test(hay)
          ? "EXPLICIT_NEED"
          : /بديل|توصية|مين يعرف|أنصح|تنصحوا|اقترحوا|مقارنة|أحسن من|recommend|alternative|switch/i.test(hay)
            ? "COMPETITOR_ENGAGER"
            : null
    // Normalize + store ContentItem (unique per source+externalId)
    let content
    try {
      content = await db.contentItem.create({
        data: {
          workspaceId: wsId,
          sourceId: source.id,
          externalId: item.externalId,
          canonicalUrl: item.url,
          authorName: item.authorName,
          authorHandle: item.authorHandle,
          title: item.title,
          body: item.body,
          contentType: item.contentType as never,
          status: "PROCESSED",
          publishedAt: item.publishedAt,
          language: item.language,
          rawData: item.rawData,
          contentHash: item.externalId,
        },
      })
    } catch {
      // متجمع قبل كده — لو بيزنس خرائط لسه منغير Lead، كمّل تسجيله؛ وإلا تجاوز
      if (!isMapsBusiness) continue
      const existing = await db.contentItem.findUnique({
        where: { sourceId_externalId: { sourceId: source.id, externalId: item.externalId } },
      }).catch(() => null)
      if (!existing) continue
      const alreadyLinked = await db.leadContent.findFirst({ where: { contentId: existing.id }, select: { id: true } })
      if (alreadyLinked) continue
      content = existing
    }

    // Classify (AI if available, heuristic otherwise)
    const { classification } = await classifyContent(wsId, item.title, item.body, item.rawData ? JSON.stringify(item.rawData) : undefined)
    if (!classification.is_lead && isMapsBusiness) {
      // بيزنس حقيقي من خرائط جوجل — يتحفظ كـ lead (قائمة اتصال لبيع الأنظمة حتى من غير نية معلنة)
      classification.is_lead = true
      classification.business_type = classification.business_type || (item.rawData as { category?: string })?.category || ""
      if (classification.intent === "NONE") classification.intent = "LOW"
      classification.score = Math.max(classification.score, 45)
      classification.reason = classification.reason || "بيزنس حقيقي من خرائط جوجل (قائمة استهداف)"
    }
    if (!classification.is_lead) continue

    // Dedup by business identity signals — name must match what we'd store (handle > title)
    const handleName = socialHandleName(item.url)
    const candidateName = handleName ?? title
    const candidate = {
      id: "",
      name: item.authorName ?? candidateName,
      phone: typeof (item.rawData as { phone?: string })?.phone === "string" ? (item.rawData as { phone?: string }).phone : null,
      email: null,
      websiteUrl: typeof (item.rawData as { website?: string })?.website === "string" ? (item.rawData as { website?: string }).website : null,
      mapsPlaceId: typeof (item.rawData as { placeId?: string })?.placeId === "string" ? (item.rawData as { placeId?: string }).placeId : null,
      city: null as string | null,
    }
    const dup = await findDuplicateLead(wsId, candidate)
    if (dup) {
      duplicates++
      await db.contentItem.update({ where: { id: content.id }, data: { status: "DUPLICATE" } })
      await db.leadContent.create({
        data: { leadId: dup.leadId, contentId: content.id, relationship: "duplicate_evidence", relevanceScore: 60 },
      }).catch(() => undefined)
      await db.lead.update({ where: { id: dup.leadId }, data: { lastSeenAt: new Date() } })
      continue
    }

    // Create Business + Lead — prefer the platform handle (clean page name) over SERP title
    const businessName = candidateName
    const business = await db.business.create({
      data: {
        workspaceId: wsId,
        name: businessName,
        industry: classification.business_type || (item.rawData as { category?: string })?.category || null,
        category: (item.rawData as { category?: string })?.category ?? null,
        city: (item.rawData as { city?: string })?.city ?? null,
        address: (item.rawData as { address?: string })?.address ?? null,
        latitude: (item.rawData as { latitude?: number })?.latitude ?? undefined,
        longitude: (item.rawData as { longitude?: number })?.longitude ?? undefined,
        country: "Egypt",
        phone: normalizePhone(candidate.phone) ? candidate.phone : null,
        websiteUrl: candidate.websiteUrl,
        mapsPlaceId: candidate.mapsPlaceId,
        mapsUrl: candidate.mapsPlaceId
          ? `https://www.google.com/maps/place/?q=place_id:${candidate.mapsPlaceId}`
          : (typeof (item.rawData as { cid?: string })?.cid === "string" && (item.rawData as { cid?: string }).cid
            ? `https://maps.google.com/?cid=${(item.rawData as { cid?: string }).cid}`
            : null),
        rating: (item.rawData as { rating?: number })?.rating ?? null,
        reviewCount: (item.rawData as { reviewCount?: number })?.reviewCount ?? null,
        businessSources: {
          create: { sourceType: (source.type as string), sourceUrl: item.url, externalId: item.externalId },
        },
      },
    })
    const lead = await db.lead.create({
      data: {
        workspaceId: wsId,
        businessId: business.id,
        status: "NEW",
        leadSourceType: (typeof (item.rawData as { platform?: string } | null)?.platform === "string"
          ? (["FACEBOOK", "INSTAGRAM", "X", "LINKEDIN", "REDDIT", "TIKTOK", "YOUTUBE"].includes((item.rawData as { platform?: string }).platform as string) ? "SOCIAL" : (item.rawData as { platform?: string }).platform === "GOOGLE_MAPS" ? "GOOGLE_MAPS" : "DISCOVERY")
          : source.type === "GOOGLE_MAPS" ? "GOOGLE_MAPS" : "DISCOVERY") as never,
        sourcePlatform: itemPlatform ?? (source.type === "GOOGLE_MAPS" ? "GOOGLE_MAPS" : null),
        intentSignal,
        metadata: { platform: itemPlatform ?? null, intentSignal, discoveredVia: source.name } as Prisma.InputJsonValue,
        intent: classification.intent,
        intentScore: classification.intent === "VERY_HIGH" ? 95 : classification.intent === "HIGH" ? 80 : 55,
        urgencyScore: classification.urgency === "high" ? 90 : classification.urgency === "medium" ? 60 : 30,
        serviceNeeds: classification.services,
        painPoints: [],
        summary: `${item.title ?? candidate.name}: ${item.body.slice(0, 160)}`,
        whyNow: classification.reason,
        contentLinks: { create: { contentId: content.id, relationship: "primary", relevanceScore: 95 } },
      },
    })
    const leadPlatform = itemPlatform ?? source.type
    const isSocial = ["FACEBOOK", "INSTAGRAM", "X", "LINKEDIN", "REDDIT", "TIKTOK", "YOUTUBE"].includes(leadPlatform)
    await db.leadSource.create({
      data: { leadId: lead.id, sourceType: (isSocial ? "SOCIAL" : leadPlatform === "GOOGLE_MAPS" ? "GOOGLE_MAPS" : "DISCOVERY") as never, sourceUrl: item.url, label: `${source.name} — ${leadPlatform}` },
    })
    leadsCreated++
    await recomputeLeadScore(lead.id, { workspaceId: wsId })
    // مكافأة أولوية الصياد: صاحب الحاجة الصريحة +8 واللي بيقارن بالمنافسين +5
    if (intentSignal === "EXPLICIT_NEED" || intentSignal === "COMPETITOR_ENGAGER") {
      await db.lead.update({ where: { id: lead.id }, data: { score: { increment: intentSignal === "EXPLICIT_NEED" ? 8 : 5 } } }).catch(() => undefined)
    }

    // سلاسل المتابعة: تجنيد تلقائي للليد الجديد في سلسلة النشر (لو مفعّلة)
    // سياسة الرد-فقط: الخطوات بتطلع مهام بنص جاهز — مفيش إرسال آلي استباقي
    try {
      const nurtureSeq = await db.sequence.findFirst({
        where: { workspaceId: wsId, enabled: true, kind: "NURTURE" },
        select: { id: true, steps: { where: { active: true }, select: { id: true }, take: 1 } },
      })
      if (nurtureSeq?.steps.length) await enrollLead(wsId, lead.id, nurtureSeq.id)
    } catch { /* السلاسل اختيارية — فشل التجنيد ميوقفش الاكتشاف */ }

    // Hot leads go straight to Deep Research (doc §70)
    if (rule?.startResearch !== false && classification.score >= 80) {
      const run = await db.researchRun.create({
        data: { workspaceId: wsId, leadId: lead.id, depth: (rule?.researchDepth ?? "DEEP") as never, status: "QUEUED" },
      })
      await enqueueJob(wsId, "DEEP_RESEARCH", { researchRunId: run.id, leadId: lead.id }, 80)
    }
  }

  return { created: leadsCreated, duplicates }
}

async function processResearchJob(jobId: string): Promise<string> {
  const job = await db.job.findUnique({ where: { id: jobId } })
  if (!job) return "job missing"
  const payload = (job.payload ?? {}) as { researchRunId?: string; leadId?: string }
  if (!payload.researchRunId || !payload.leadId) return "bad payload"
  const run = await db.researchRun.findUnique({ where: { id: payload.researchRunId } })
  if (!run) return "run missing"
  if (run.status === "COMPLETED") return "already done"
  await runDeepResearch(job.workspaceId, payload.leadId, payload.researchRunId, run.depth)
  return "research completed"
}

// ══════════ الموجة الجديدة: إعادة التفعيل + التقييم الذاتي للمصادر ══════════

async function processReactivationJob(jobId: string): Promise<string> {
  const job = await db.job.findUnique({ where: { id: jobId } })
  if (!job) return "job missing"
  const { enrolled, skipped } = await reactivationSweep(job.workspaceId)
  return `reactivation enrolled=${enrolled} skipped=${skipped}`
}

/** التقييم الذاتي للمصادر (طلب: زيزو يطور مصادره لوحده) — أسبوعيًا */
async function processSourceEvaluationJob(jobId: string): Promise<string> {
  const job = await db.job.findUnique({ where: { id: jobId } })
  if (!job) return "job missing"
  const wsId = job.workspaceId
  const sources = await db.source.findMany({
    where: { workspaceId: wsId },
    select: { id: true, name: true, type: true, status: true, _count: { select: { contents: true } } },
  })
  const stats: Array<{ name: string; type: string; contents: number; leads: number; conversions: number }> = []
  for (const s of sources) {
    const leads = await db.leadContent.count({ where: { content: { sourceId: s.id } } })
    const conversions = leads
      ? await db.lead.count({ where: { status: "WON", contentLinks: { some: { content: { sourceId: s.id } } } } })
      : 0
    stats.push({ name: s.name, type: s.type, contents: s._count.contents, leads, conversions })
  }
  const usedTypes = new Set(sources.map((s) => s.type))
  const unused = Object.keys(PLATFORM_SITES).filter((t) => !usedTypes.has(t))
  const zeroYield = stats.filter((s) => s.contents >= 20 && s.leads === 0)
  const top = [...stats].sort((a, b) => b.leads - a.leads)[0]

  const summary = [
    `مصادر نشطة: ${sources.length}`,
    top && top.leads > 0 ? `أعلى مصدر: «${top.name}» بـ ${top.leads} ليد` : "مفيش مصدر جاب ليدز لسه",
    zeroYield.length ? `مصادر ضعيفة (${zeroYield.length}): ${zeroYield.slice(0, 3).map((s) => s.name).join("، ")}` : "",
    unused.length ? `أنواع مش مستخدمة ممكن تجيب ليدز: ${unused.slice(0, 6).join("، ")}` : "",
  ].filter(Boolean).join(" | ")

  await db.agentInsight.create({
    data: {
      workspaceId: wsId,
      kind: "platform_signal",
      pattern: "source_evaluation_weekly",
      note: summary,
      evidence: { stats, unusedSourceTypes: unused } as Prisma.InputJsonValue,
      weight: 2,
    },
  })
  if (zeroYield.length || unused.length) {
    await db.alert.create({
      data: {
        workspaceId: wsId,
        type: "SOURCE_EVALUATION",
        title: "تقرير زيزو الأسبوعي عن المصادر",
        message: summary,
        severity: "INFO",
        actionUrl: "/sources",
      },
    })
  }
  return summary.slice(0, 200)
}

/** Main tick: create scheduled discovery jobs from rules, then process a batch. */
export async function processTick(
  maxJobs = 6,
  opts?: { fullSweep?: boolean },
): Promise<{ processed: number; details: string[]; scheduledRules: number }> {
  // 0) Recover stale RUNNING jobs (worker crashed mid-job)
  await db.job.updateMany({
    where: { status: "RUNNING", lockedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } },
    data: { status: "QUEUED", lockedAt: null, workerId: null },
  })

  // 0.5) المسح الشامل: جوبة اكتشاف لكل ورشة على كل المنصات دفعة واحدة (؟full=1)
  // — بتزرع الـ16 مصدر بالليدز فورًا بدل ما الموجة الدوارة تاخد ساعات
  if (opts?.fullSweep) {
    const wsIds = await db.workspace.findMany({ where: { isActive: true }, select: { id: true }, take: 3 })
    for (const w of wsIds) {
      await enqueueJob(w.id, "DISCOVERY", { fullSweep: true, query: "عملاء محتاجين خدمات رقمية في مصر" }, 80)
    }
  }

  // 1) Scheduler: enqueue due rules (every tick checks; jobs are cheap and idempotent)
  const rules = await db.searchRule.findMany({ where: { enabled: true }, orderBy: { priority: "desc" } })
  let scheduledRules = 0
  for (const rule of rules) {
    const recentJobs = await db.job.findMany({
      where: {
        workspaceId: rule.workspaceId,
        type: "DISCOVERY",
        createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      },
      select: { payload: true },
    })
    const hasRecent = recentJobs.some((j) => (j.payload as { ruleId?: string } | null)?.ruleId === rule.id)
    // Rate-limit: one discovery job per rule per 10 minutes
    if (hasRecent) continue
    const sources = await db.source.findMany({ where: { workspaceId: rule.workspaceId, status: "ACTIVE" }, take: 1 })
    await enqueueJob(rule.workspaceId, "DISCOVERY", {
      ruleId: rule.id,
      sourceId: sources[0]?.id,
      sourceTypes: asArray(rule.sourceTypes),
    }, rule.priority > 100 ? 70 : 50)
    scheduledRules++
    if (scheduledRules >= 3) break
  }

  // 2) Process queued jobs
  const jobs = await claimJobs(maxJobs)
  const details: string[] = []
  for (const job of jobs) {
    try {
      let result = ""
      if (job.type === "DISCOVERY") result = await processDiscoveryJob(job.id)
      else if (job.type === "DEEP_RESEARCH") result = await processResearchJob(job.id)
      else if (job.type === "REACTIVATION") result = await processReactivationJob(job.id)
      else if (job.type === "SOURCE_EVALUATION") result = await processSourceEvaluationJob(job.id)
      else result = `no handler for type ${job.type}`
      await db.job.update({
        where: { id: job.id },
        data: { status: "SUCCESS", completedAt: new Date(), result: { message: result } as Prisma.InputJsonValue },
      })
      details.push(`${job.type}: ${result}`)
    } catch (err) {
      const attempts = job.attempts + 1
      const permanent = attempts >= job.maxAttempts
      await db.job.update({
        where: { id: job.id },
        data: {
          status: permanent ? "FAILED" : "RETRYING",
          completedAt: permanent ? new Date() : null,
          errorMessage: err instanceof Error ? err.message.slice(0, 400) : String(err).slice(0, 400),
          scheduledAt: new Date(Date.now() + Math.min(600000, 60000 * Math.pow(2, attempts))), // exponential backoff
        },
      })
      details.push(`${job.type}: FAILED (${err instanceof Error ? err.message.slice(0, 120) : err})`)
    }
  }
  // 3) سلاسل المتابعة: معالجة الخطوات المستحقة (لكل ورشة عليها مستحق)
  const dueWs = await db.sequenceEnrollment.findMany({
    where: { status: "ACTIVE", nextStepAt: { lte: new Date() } },
    distinct: ["workspaceId"],
    select: { workspaceId: true },
    take: 5,
  })
  for (const { workspaceId } of dueWs) {
    try {
      const r = await processDueEnrollments(workspaceId, 10)
      if (r.processed || r.completed) details.push(`SEQUENCE: steps=${r.processed} completed=${r.completed} tasks=${r.tasks}`)
    } catch (err) {
      details.push(`SEQUENCE: FAILED (${err instanceof Error ? err.message.slice(0, 100) : err})`)
    }
  }

  // 4) إعادة التفعيل: مسح يومي للليدز الباردة (كل 20 ساعة)
  const lastReactivation = await db.job.findFirst({
    where: { type: "REACTIVATION", createdAt: { gte: new Date(Date.now() - 20 * 3600_000) } },
    select: { id: true },
  })
  if (!lastReactivation) {
    const wsIds = await db.workspace.findMany({ where: { isActive: true }, select: { id: true }, take: 5 })
    for (const w of wsIds) await enqueueJob(w.id, "REACTIVATION", {}, 30, new Date(Date.now() + 60_000))
    details.push("REACTIVATION sweep scheduled")
  }

  // 5) التقييم الذاتي للمصادر: أسبوعيًا (كل 7 أيام)
  const lastEval = await db.job.findFirst({
    where: { type: "SOURCE_EVALUATION", createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600_000) } },
    select: { id: true },
  })
  if (!lastEval) {
    const wsIds = await db.workspace.findMany({ where: { isActive: true }, select: { id: true }, take: 5 })
    for (const w of wsIds) await enqueueJob(w.id, "SOURCE_EVALUATION", {}, 20, new Date(Date.now() + 120_000))
    details.push("SOURCE_EVALUATION scheduled")
  }

  return { processed: jobs.length, details, scheduledRules }
}
