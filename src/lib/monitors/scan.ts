// LeadOS — Group Scan & Discovery orchestrator (تحدي الجروبات)
// المسح: كل جروب مراقَب بيتجاب منشوراته الجديدة، تتصنّف وتتقيّم وتتحفظ.
// الاكتشاف: بحث حي عن جروبات جديدة مناسبة (أسماء الجروبات مفهرسة 10/10).
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { classifyPost, scoreGroupName, type Segment } from "./segments"
import { fetchGroupPosts, parseGroupInput, type RawPost } from "./fetchers"
import { agentWebSearch } from "@/lib/discovery"
import { sessionCookieOf } from "@/lib/capabilities"

const SCAN_COOLDOWN_MS = 15 * 60 * 1000 // جروب ميتمسحش أكتر من مرة كل 15 دقيقة

export interface ScanOutcome {
  groupId: string
  name: string
  platform: string
  status: string
  newPosts: number
  note?: string
}

/** يحفظ منشورات خام في جروب مع التصنيف والتقييم (مع إزالة التكرار) */
async function ingestRawPosts(
  group: { id: string; workspaceId: string; platform: string; name: string; externalId: string },
  rawPosts: RawPost[],
): Promise<number> {
  let created = 0
  for (const rp of rawPosts) {
    const externalId = rp.externalId ?? `h:${rp.url ?? rp.content.slice(0, 80)}`
    const existing = await db.groupPost.findFirst({
      where: { groupId: group.id, externalId },
      select: { id: true },
    })
    if (existing) continue
    const cls = classifyPost(rp.content, group.name)
    try {
      await db.groupPost.create({
        data: {
          groupId: group.id,
          externalId,
          url: rp.url,
          author: rp.author,
          content: rp.content,
          postedAt: rp.postedAt && !Number.isNaN(rp.postedAt.getTime()) ? rp.postedAt : null,
          score: cls.score,
          segment: cls.segment,
          matchedKeywords: cls.matchedKeywords as Prisma.InputJsonValue,
          // بوست قوي من غير مراجعة يتعلم مؤهل مباشرة
          status: cls.score >= 75 ? "QUALIFIED" : "NEW",
        },
      })
      created++
    } catch {
      // تعارض unique أو بيانات ناقصة — تجاهل وكمّل
    }
  }
  return created
}

/** تحديث مؤشرات النشاط والصحة للجروب */
async function updateGroupAfterScan(
  groupId: string,
  data: { lastPostAt?: Date | null; membersText?: string },
  newPosts: number,
): Promise<void> {
  const weekAgo = new Date(Date.now() - 7 * 864e5)
  const [recent, total] = await Promise.all([
    db.groupPost.count({ where: { groupId, detectedAt: { gte: weekAgo } } }),
    db.groupPost.count({ where: { groupId } }),
  ])
  await db.monitoredGroup.update({
    where: { id: groupId },
    data: {
      lastScannedAt: new Date(),
      lastPostAt: data.lastPostAt ?? undefined,
      membersText: data.membersText ?? undefined,
      postCount: total,
      activityScore: Math.min(100, recent * 12 + (recent > 0 ? 20 : 0)),
      ...(newPosts > 0 ? { status: "ACTIVE", statusNote: null } : {}),
    },
  })
}

/** مسح جروب واحد — بيرجع ملخص */
export async function scanGroup(group: {
  id: string
  workspaceId: string
  platform: string
  name: string
  externalId: string
  url: string
}): Promise<ScanOutcome> {
  const result = await fetchGroupPosts(group).catch((err) => ({
    posts: [] as RawPost[],
    status: "ERROR" as const,
    note: `فشل الاتصال: ${err instanceof Error ? err.message.slice(0, 100) : "خطأ"}`,
  }))

  if (result.status === "NEEDS_SESSION" || result.status === "BLOCKED") {
    await db.monitoredGroup.update({
      where: { id: group.id },
      data: {
        status: result.status,
        statusNote: result.note?.slice(0, 300) ?? null,
        lastScannedAt: new Date(),
      },
    })
    return { groupId: group.id, name: group.name, platform: group.platform, status: result.status, newPosts: 0, note: result.note }
  }

  if (result.status === "ERROR") {
    await db.monitoredGroup.update({
      where: { id: group.id },
      data: { lastScannedAt: new Date(), statusNote: result.note?.slice(0, 300) ?? null },
    })
    return { groupId: group.id, name: group.name, platform: group.platform, status: "ERROR", newPosts: 0, note: result.note }
  }

  let newPosts = 0
  let lastPostAt: Date | undefined
  if (result.posts.length) {
    newPosts = await ingestRawPosts(group, result.posts)
    const dates = result.posts.map((p) => p.postedAt).filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()))
    if (dates.length) lastPostAt = new Date(Math.max(...dates.map((d) => d.getTime())))
  }
  await updateGroupAfterScan(group.id, { lastPostAt, membersText: result.membersText }, newPosts)
  return {
    groupId: group.id,
    name: group.name,
    platform: group.platform,
    status: result.status,
    newPosts,
    note: result.note,
  }
}

/** مسح كل الجروبات المستحقة (cooldown 15 دقيقة) — للـcron والزر اليدوي */
export async function scanDueGroups(workspaceId: string, limit = 3): Promise<ScanOutcome[]> {
  // SESSIONLESS: لو مفيش جلسة فيسبوك (DB/env) ولا Apify — استبعد جروبات فيسبوك عشان متزنقش الطابور،
  // والمسح يكمل عادي على تليجرام/ريديت/X — غياب الجلسة مش بيوقف الاكتشاف (طلب §20)
  const { cookie: fbSession } = await sessionCookieOf("FACEBOOK")
  const fbCapable = Boolean(fbSession || process.env.APIFY_TOKEN)
  const due = await db.monitoredGroup.findMany({
    where: {
      workspaceId,
      status: { in: ["ACTIVE", "NEEDS_SESSION"] },
      ...(fbCapable ? {} : { platform: { not: "FACEBOOK" } }),
      OR: [{ lastScannedAt: null }, { lastScannedAt: { lt: new Date(Date.now() - SCAN_COOLDOWN_MS) } }],
    },
    orderBy: { lastScannedAt: "asc" },
    take: limit,
  })
  const out: ScanOutcome[] = []
  for (const g of due) {
    out.push(await scanGroup(g))
  }
  return out
}

// ══════════ اكتشاف جروبات جديدة ══════════

export interface DiscoverResult {
  created: Array<{ id: string; name: string; url: string; platform: string; intentScore: number }>
  skipped: number
  note?: string
}

async function upsertGroupCandidate(
  workspaceId: string,
  parsed: { platform: string; externalId: string; url: string },
  name: string,
  segment: Segment,
  membersText?: string,
): Promise<{ created: boolean; group?: { id: string; name: string; url: string; platform: string; intentScore: number } }> {
  const existing = await db.monitoredGroup.findFirst({
    where: { workspaceId, platform: parsed.platform, externalId: parsed.externalId },
    select: { id: true },
  })
  if (existing) return { created: false }
  const cleanName = name.replace(/\s*[|\-–—]\s*(Facebook|فيسبوك|Telegram|تليجرام|Reddit|ريديت)\s*$/i, "").trim().slice(0, 90) || parsed.externalId
  const intentScore = scoreGroupName(cleanName)
  const group = await db.monitoredGroup.create({
    data: {
      workspaceId,
      platform: parsed.platform,
      externalId: parsed.externalId,
      url: parsed.url,
      name: cleanName,
      segment,
      intentScore,
      membersText: membersText ?? null,
    },
  })
  return {
    created: true,
    group: { id: group.id, name: group.name, url: group.url, platform: group.platform, intentScore },
  }
}

/** اكتشاف جروبات بالكلمات المفتاحية عبر البحث الحي + إنشاء مراقبة كلمات X فورًا */
export async function discoverGroups(opts: {
  workspaceId: string
  platform: string
  keywords: string[]
  segment?: Segment
}): Promise<DiscoverResult> {
  const segment: Segment = opts.segment ?? "BOTH"
  const created: DiscoverResult["created"] = []
  let skipped = 0
  const keywords = opts.keywords.map((k) => k.trim()).filter(Boolean).slice(0, 4)

  if (opts.platform === "X") {
    for (const kw of keywords) {
      const parsed = parseGroupInput("", kw)
      if (!parsed) continue
      const res = await upsertGroupCandidate(opts.workspaceId, parsed, `مراقبة X: ${kw}`, segment)
      if (res.created && res.group) created.push(res.group)
      else skipped++
    }
    return { created, skipped }
  }

  const QUERY_TEMPLATES: Record<string, (kw: string) => string> = {
    FACEBOOK: (kw) => `site:facebook.com/groups ${kw}`,
    TELEGRAM: (kw) => `site:t.me ${kw}`,
    REDDIT: (kw) => `site:reddit.com/r ${kw}`,
  }
  const template = QUERY_TEMPLATES[opts.platform]
  if (!template) return { created, skipped, note: "منصة غير مدعومة للاكتشاف" }

  for (const kw of keywords) {
    const { results } = await agentWebSearch(template(kw), 10, 365)
    for (const r of results) {
      const parsed = parseGroupInput(r.url)
      if (!parsed || parsed.platform !== opts.platform) { skipped++; continue }
      const membersMatch = r.snippet.match(/([\d.,]+\s*[KM]?\+?\s*(?:عضو|members?|subscriber))/i)
      const res = await upsertGroupCandidate(opts.workspaceId, parsed, r.name || parsed.externalId, segment, membersMatch?.[1])
      if (res.created && res.group) created.push(res.group)
      else skipped++
      if (created.length >= 10) break
    }
    if (created.length >= 10) break
  }
  return { created, skipped, note: created.length ? undefined : "مفيش جروبات جديدة اتحفظت — جرّب كلمات تانية" }
}
