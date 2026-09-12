import { db } from "@/lib/db"
import { json, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { aiChat, aiProviderStatus } from "@/lib/ai"

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const [aiRunsCount, aiRunsByType, totalTokens, estimatedRuns] = await Promise.all([
    db.aiRun.count({ where: { workspaceId: auth.workspace.id } }),
    db.aiRun.groupBy({ by: ["type"], where: { workspaceId: auth.workspace.id }, _count: true, _avg: { latencyMs: true } }),
    db.aiRun.aggregate({ where: { workspaceId: auth.workspace.id }, _sum: { totalTokens: true } }),
    db.aiRun.findMany({
      where: { workspaceId: auth.workspace.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, type: true, provider: true, model: true, latencyMs: true, totalTokens: true, createdAt: true, success: true },
    }),
  ])
  return json({
    status: aiProviderStatus(),
    googleMapsKey: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    stats: {
      totalRuns: aiRunsCount,
      totalTokens: totalTokens._sum.totalTokens ?? 0,
      byType: aiRunsByType.map((t) => ({ type: t.type, count: t._count, avgLatency: Math.round(t._avg.latencyMs ?? 0) })),
      recent: estimatedRuns,
    },
  })
}

/** Test AI connectivity from Settings. */
export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = await readBody<{ prompt?: string }>(req)
  const prompt = body?.prompt?.trim() || "رد بكلمة واحدة: جاهز"
  const result = await aiChat(
    [
      { role: "system", content: "أنت مساعد LeadOS. أجب بإيجاز شديد." },
      { role: "user", content: prompt },
    ],
    { workspaceId: auth.workspace.id, runType: "OTHER", maxTokens: 60, temperature: 0.1 },
  )
  if (!result) return json({ ok: false, error: "تعذر الاتصال بمحرك الذكاء الاصطناعي" }, 502)
  return json({ ok: true, provider: result.provider, model: result.model, latencyMs: result.latencyMs, response: result.text.slice(0, 300) })
}
