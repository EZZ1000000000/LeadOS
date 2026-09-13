// LeadOS — GET /api/agent/runs : سجل تشغيلات الأيجنت (مع الخطوات لآخر تشغيل)
import { db } from "@/lib/db"
import { json, requireAuth, isResponse } from "@/lib/api-helpers"
import { toolStatus } from "@/lib/agent/tools"
import { topInsights } from "@/lib/agent/memory"

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const url = new URL(req.url)
  const runId = url.searchParams.get("runId")

  const runs = await db.agentRun.findMany({
    where: { workspaceId: auth.workspace.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { steps: { orderBy: { idx: "asc" }, select: { idx: true, tool: true, note: true, status: true, durationMs: true, output: true } } },
  })
  const insights = await topInsights(auth.workspace.id, 8)
  const selected = runId ? runs.find((r) => r.id === runId) : runs[0]
  return json({
    runs: runs.map((r) => ({ ...r, steps: r.id === selected?.id ? r.steps : [] })),
    insights,
    tools: toolStatus(),
  })
}
