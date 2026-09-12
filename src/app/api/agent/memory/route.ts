// LeadOS — GET /api/agent/memory : "سرش للسرش" — فحص ذاكرة البحث قبل الويب + أفضل الاستعلامات
import { db } from "@/lib/db"
import { json, requireAuth, isResponse } from "@/lib/api-helpers"
import { lookupSearchMemory, topMemoryQueries, topInsights } from "@/lib/agent/memory"

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const url = new URL(req.url)
  const q = url.searchParams.get("q")

  const hits = q ? await lookupSearchMemory(auth.workspace.id, q, { minSimilarity: 0.3, limit: 6 }) : []
  const topQueries = await topMemoryQueries(auth.workspace.id, 12)
  const insights = await topInsights(auth.workspace.id, 8)
  return json({
    query: q ?? null,
    hits,
    topQueries: topQueries.map((m) => ({
      id: m.id, query: m.query, platform: m.platform, qualityScore: m.qualityScore,
      leadCount: m.leadCount, bestScore: m.bestScore, hitCount: m.hitCount,
      lastUsedAt: m.lastUsedAt, bestResults: (m.bestResults as Array<{ title: string; url: string }>) ?? [],
    })),
    insights,
    memorySize: await db.searchMemory.count({ where: { workspaceId: auth.workspace.id } }),
  })
}
