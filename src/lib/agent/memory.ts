// LeadOS — Agent Memory Layer
// "دوّر على دورك قبل ما تدوّر": كل استعلام يُنفَّذ يُحفظ بنتائجه وجودته،
// والأيجنت يفحص الذاكرة أولًا (exact + تقارب كلمات + تقارب دلالي بالإيمبدنج) قبل لمس الويب.
// ثلاث طبقات: ذاكرة الاستعلام (SearchMemory) + ذاكرة أفضل نتيجة (bestResults) + ذاكرة الاستنتاجات (AgentInsight)
import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { aiEmbed, cosineSim } from "@/lib/ai"

// ---------- Normalization ----------
const AR_STOPWORDS = new Set(["في", "من", "على", "عن", "الى", "إلى", "اللي", "دي", "ده", "دا", "عاوذ", "عايز", "محتاج", "محتاجة", "دورلي", "دور", "ابحث", "أبحث", "يجيب", "جيب", "كل", "عام", "عامة", "الجديدة", "جديد", "كويسة", "كويس", "أحسن", "احسن", "مصر", "egypt", "egyptian", "in", "for", "the", "a", "an", "of", "and", "or", "to", "with", "need", "want", "looking", "find", "get", "best"])
const AR_PREFIX = /^(ال|وال|بال|فال|لل|وك|ف|و|ل|ب)/

export function normalizeQuery(q: string): string {
  const words = q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !AR_STOPWORDS.has(w))
    .map((w) => w.replace(AR_PREFIX, ""))
    .filter((w) => w.length > 1)
  return [...new Set(words)].sort().join(" ")
}

export function queryHash(wsId: string, normalized: string): string {
  let h = 5381
  const s = `${wsId}:${normalized}`
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

/** نسبة تقارب بين استعلامين (Jaccard على الكلمات) */
export function similarity(a: string, b: string): number {
  const A = new Set(a.split(" ").filter(Boolean))
  const B = new Set(b.split(" ").filter(Boolean))
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const w of A) if (B.has(w)) inter++
  return inter / (A.size + B.size - inter)
}

// ---------- Memory lookup (سرش للسرش) ----------
export interface MemoryHit {
  id: string
  query: string
  platform: string
  similarity: number
  qualityScore: number
  leadCount: number
  bestScore: number
  resultCount: number
  bestResults: Array<{ title: string; url: string; score?: number }>
  ageHours: number
  hitCount: number
}

export async function lookupSearchMemory(wsId: string, query: string, opts?: { minSimilarity?: number; limit?: number }): Promise<MemoryHit[]> {
  const normalized = normalizeQuery(query)
  if (!normalized) return []
  const exactHash = queryHash(wsId, normalized)

  // جلب ذاكرة كافية للمقارنة (آخر 500 استعلام — أسرع من أي FTS في SQLite)
  const rows = await db.searchMemory.findMany({
    where: { workspaceId: wsId },
    orderBy: [{ lastUsedAt: "desc" }],
    take: 500,
  })

  const minSim = opts?.minSimilarity ?? 0.45
  const hits = rows
    .map((r) => {
      const sim = r.queryHash === exactHash ? 1 : similarity(normalized, r.normalizedQuery)
      return { r, sim }
    })
    .filter(({ sim }) => sim >= minSim)
    .sort((a, b) => {
      // الترتيب: الأقرب × الأجود × الأحدث
      const scoreA = a.sim * 0.6 + (a.r.qualityScore / 100) * 0.25 * freshness(a.r.lastUsedAt)
      const scoreB = b.sim * 0.6 + (b.r.qualityScore / 100) * 0.25 * freshness(b.r.lastUsedAt)
      return scoreB - scoreA
    })
    .slice(0, opts?.limit ?? 5)
    .map(({ r, sim }): MemoryHit => ({
      id: r.id,
      query: r.query,
      platform: r.platform,
      similarity: Math.round(sim * 100) / 100,
      qualityScore: r.qualityScore,
      leadCount: r.leadCount,
      bestScore: r.bestScore,
      resultCount: r.resultCount,
      bestResults: (r.bestResults as MemoryHit["bestResults"]) ?? [],
      ageHours: Math.round((Date.now() - r.lastUsedAt.getTime()) / 3600000),
      hitCount: r.hitCount,
    }))

  // ── الطبقة الدلالية: لو المعجمي مش لاقي كفاية → تشابه معنوي بالمتجهات ──
  // بيفهم إن "عيادات أسنان في مصر الجديدة" و"دكتور أسنان بمدينة نصر" نفس المعنى
  // حتى لو مفيش كلمة مشتركة — متجهات NVIDIA nemotron-3-embed (best-effort، فشلها مش بيكسر الذاكرة)
  // العتبة 0.45 مضبوطة قياسيًا: متشابه معنوي ~0.5، غير مرتبط ~0.17 (scripts/test-router-live.ts)
  if (hits.length < (opts?.limit ?? 5)) {
    const exact = hits.some((h) => h.similarity >= 1)
    if (!exact) {
      try {
        // ملاحظة قياسية: الموديل nemotron-3-embed بيتقوى في المساحة المتماثلة —
        // passage×passage = 0.766 لمتشابه معنوي (مقابل query×passage = 0.429) — عشان كده النوعين passage
        const emb = await aiEmbed([query], { inputType: "passage" })
        if (emb?.vectors[0]?.length) {
          const qv = emb.vectors[0]
          const seen = new Set(hits.map((h) => h.id))
          const semantic = rows
            .filter((r) => r.embedding && !seen.has(r.id))
            .map((r) => ({ r, sim: cosineSim(qv, r.embedding as unknown as number[]) }))
            .filter(({ sim }) => sim >= 0.45)
            .sort((a, b) => b.sim - a.sim)
            .slice(0, 3)
          for (const { r, sim } of semantic) {
            hits.push({
              id: r.id, query: r.query, platform: r.platform,
              similarity: Math.round(sim * 100) / 100,
              qualityScore: r.qualityScore, leadCount: r.leadCount,
              bestScore: r.bestScore, resultCount: r.resultCount,
              bestResults: (r.bestResults as MemoryHit["bestResults"]) ?? [],
              ageHours: Math.round((Date.now() - r.lastUsedAt.getTime()) / 3600000),
              hitCount: r.hitCount,
            })
          }
        }
      } catch {
        // الإيمبدنج best-effort — المعجمي يكفي لو فشل
      }
    }
  }
  return hits
}

function freshness(d: Date): number {
  const hours = (Date.now() - d.getTime()) / 3600000
  if (hours <= 24) return 1
  if (hours <= 72) return 0.8
  if (hours <= 168) return 0.5
  return 0.2
}

/** هل الذاكرة كافية للرد من غير ويب؟ (جودة عالية + حديثة نسبيًا + فيها ليدز فعلًا) */
export function isMemoryUsable(hit: MemoryHit): boolean {
  return hit.qualityScore >= 50 && hit.leadCount > 0 && hit.ageHours <= 72 && hit.bestResults.length > 0
}

// ---------- Memory save ----------
export interface SaveMemoryInput {
  query: string
  platform: string
  resultCount: number
  leadCount: number
  avgScore: number
  bestScore: number
  provider?: string
  bestResults?: Array<{ title: string; url: string; score?: number }>
  insights?: string[]
}

/** جودة الاستعلام كمنجم ليدز: ليدز فعلية + سكور + حجم نتايج */
export function computeQualityScore(input: SaveMemoryInput): number {
  const leadPart = Math.min(60, input.leadCount * 8)
  const scorePart = Math.round((input.avgScore / 100) * 25)
  const volumePart = input.resultCount >= 5 ? 15 : input.resultCount * 3
  return Math.min(100, leadPart + scorePart + volumePart)
}

export async function saveSearchMemory(wsId: string, input: SaveMemoryInput) {
  const normalized = normalizeQuery(input.query)
  if (!normalized) return null
  const hash = queryHash(wsId, normalized)
  // دمج أفضل النتايج عبر الزيارات (الذاكرة بتفضل تتحسن)
  const existing = await db.searchMemory.findUnique({
    where: { workspaceId_queryHash_platform: { workspaceId: wsId, queryHash: hash, platform: input.platform } },
  })
  // القيم المدموجة تراكمية — الذاكرة ما بتتنسى ولا بتتدهور مع الإعادات
  const merged = {
    leadCount: existing ? Math.max(existing.leadCount, input.leadCount) : input.leadCount,
    avgScore: existing ? Math.max(existing.avgScore, input.avgScore) : input.avgScore,
    bestScore: existing ? Math.max(existing.bestScore, input.bestScore) : input.bestScore,
    resultCount: existing ? Math.max(existing.resultCount, input.resultCount) : input.resultCount,
  }
  const quality = computeQualityScore({ ...input, ...merged })
  const mergedBest = mergeBest(existing?.bestResults as SaveMemoryInput["bestResults"], input.bestResults ?? [])
  // متجه دلالي best-effort (بيعيد استخدام نفس الصف لو المرة الأولى فشلت)
  const semanticVector = await aiEmbed([input.query], { inputType: "passage" })
    .then((e) => (e?.vectors[0]?.length ? (e.vectors[0] as unknown as Prisma.InputJsonValue) : undefined))
    .catch(() => undefined)
  return db.searchMemory.upsert({
    where: { workspaceId_queryHash_platform: { workspaceId: wsId, queryHash: hash, platform: input.platform } },
    create: {
      workspaceId: wsId,
      query: input.query,
      queryHash: hash,
      normalizedQuery: normalized,
      platform: input.platform,
      resultCount: merged.resultCount,
      leadCount: merged.leadCount,
      avgScore: merged.avgScore,
      bestScore: merged.bestScore,
      qualityScore: quality,
      provider: input.provider,
      bestResults: (mergedBest ?? []) as unknown as Prisma.InputJsonValue,
      insights: (input.insights ?? []) as unknown as Prisma.InputJsonValue,
      ...(semanticVector !== undefined ? { embedding: semanticVector } : {}),
    },
    update: {
      resultCount: merged.resultCount,
      leadCount: merged.leadCount,
      avgScore: merged.avgScore,
      bestScore: merged.bestScore,
      qualityScore: existing ? Math.max(existing.qualityScore, quality) : quality,
      provider: input.provider ?? existing?.provider,
      bestResults: (mergedBest ?? []) as unknown as Prisma.InputJsonValue,
      ...(semanticVector !== undefined ? { embedding: semanticVector } : {}),
      hitCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  })
}

function mergeBest(
  old: Array<{ title: string; url: string; score?: number }> | undefined | null,
  fresh: Array<{ title: string; url: string; score?: number }>,
): Array<{ title: string; url: string; score?: number }> {
  const map = new Map<string, { title: string; url: string; score?: number }>()
  for (const r of [...(old ?? []), ...fresh]) map.set(r.url, r)
  return [...map.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 10)
}

// ---------- Insights (ذاكرة الاستنتاجات) ----------
export async function recordInsight(wsId: string, kind: string, pattern: string, note: string, evidence?: unknown) {
  const existing = await db.agentInsight.findFirst({ where: { workspaceId: wsId, kind, pattern } })
  if (existing) {
    return db.agentInsight.update({ where: { id: existing.id }, data: { weight: { increment: 1 }, note, evidence: evidence as Prisma.InputJsonValue } })
  }
  return db.agentInsight.create({
    data: { workspaceId: wsId, kind, pattern, note, evidence: evidence as Prisma.InputJsonValue },
  })
}

export async function topInsights(wsId: string, limit = 10) {
  return db.agentInsight.findMany({ where: { workspaceId: wsId }, orderBy: [{ weight: "desc" }, { createdAt: "desc" }], take: limit })
}

/** أفضل استعلامات الذاكرة (للوحة الأيجنت) */
export async function topMemoryQueries(wsId: string, limit = 12) {
  return db.searchMemory.findMany({
    where: { workspaceId: wsId },
    orderBy: [{ qualityScore: "desc" }, { lastUsedAt: "desc" }],
    take: limit,
  })
}
