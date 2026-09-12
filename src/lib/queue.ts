// LeadOS — DB-backed Job Queue + Orchestrator (doc §8, §52)
// Replaces Redis/Celery for the free-tier deployment: the Job table IS the queue.
// A cron ping hits /api/cron/tick which calls processTick() — idempotent, batched.
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { asArray } from "@/lib/constants"
import { buildSearchPlan, runDiscovery, type DiscoveredItem } from "@/lib/discovery"
import { classifyContent } from "@/lib/classification"
import { findDuplicateLead, normalizePhone } from "@/lib/dedup"
import { recomputeLeadScore } from "@/lib/scoring"
import { runDeepResearch } from "@/lib/research"

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

  const sourceTypes = payload.sourceTypes ?? asArray(rule?.sourceTypes)
  const { items, adaptersUsed } = await runDiscovery(sourceTypes, plan.queries, 4)

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
]

/** Clean a SERP title into a usable business name (strip truncation artifacts). */
function cleanName(raw: string): string {
  return raw
    .replace(/^(title\s+)+/i, "")
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
    // JOBS platform: keep only expansion-signal roles (managers/dev/sales/marketing) —
    // generic operator/technician ads are hiring noise, not a growth lead.
    const itemPlatform = typeof (item.rawData as { platform?: string } | null)?.platform === "string"
      ? (item.rawData as { platform?: string }).platform
      : undefined
    if (itemPlatform === "JOBS" && !/مدير|manager|مبرمج|developer|مطور|مسؤول|sales|مبيعات|تسويق|marketing|محاسب|accountant|مصمم|designer|hr|موارد بشرية/i.test(title)) continue
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
      continue // already collected before
    }

    // Classify (AI if available, heuristic otherwise)
    const { classification } = await classifyContent(wsId, item.title, item.body, item.rawData ? JSON.stringify(item.rawData) : undefined)
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
        industry: classification.business_type || null,
        city: (item.rawData as { city?: string })?.city ?? null,
        country: "Egypt",
        phone: normalizePhone(candidate.phone) ? candidate.phone : null,
        websiteUrl: candidate.websiteUrl,
        mapsPlaceId: candidate.mapsPlaceId,
        mapsUrl: candidate.mapsPlaceId ? `https://www.google.com/maps/place/?q=place_id:${candidate.mapsPlaceId}` : null,
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

/** Main tick: create scheduled discovery jobs from rules, then process a batch. */
export async function processTick(maxJobs = 6): Promise<{ processed: number; details: string[]; scheduledRules: number }> {
  // 0) Recover stale RUNNING jobs (worker crashed mid-job)
  await db.job.updateMany({
    where: { status: "RUNNING", lockedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } },
    data: { status: "QUEUED", lockedAt: null, workerId: null },
  })

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
  return { processed: jobs.length, details, scheduledRules }
}
