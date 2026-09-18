// LeadOS — /api/agent/entity : الكيان المستقل (بدء / مراقبة حية / إيقاف)
// GET    → حالة حية: التشغيل الحالي + الخطوات + الدروس + إحصاءات النمو
// POST   → إطلاق الكيان على هدف (كيان واحد لكل مساحة عمل)
// DELETE → طلب إيقاف مؤقت (الكيان يختم بخلاصة ويحفظ دروسه)
import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { startEntity, isEntityActive, requestEntityStop, entityRunId } from "@/lib/agent/entity"

export const maxDuration = 60

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const wsId = auth.workspace.id

  const run = await db.agentRun.findFirst({
    where: { workspaceId: wsId, mode: "ENTITY" },
    orderBy: { createdAt: "desc" },
  })
  // شفاء ذاتي: تشغيلة RUNNING لكن الحلقة مش حية (restart/hot-reload) → تُعلَّم موقوفة
  if (run && run.status === "RUNNING" && !isEntityActive(wsId)) {
    await db.agentRun.update({
      where: { id: run.id },
      data: { status: "STOPPED", completedAt: new Date(), errorMessage: run.errorMessage ?? "انقطعت الحلقة (إعادة تشغيل سيرفر)" },
    }).catch(() => undefined)
    run.status = "STOPPED"
  }
  const steps = run
    ? await db.agentStep.findMany({ where: { runId: run.id }, orderBy: { idx: "asc" }, take: 80 })
    : []
  const insights = await db.agentInsight.findMany({
    where: { workspaceId: wsId },
    orderBy: [{ weight: "desc" }, { createdAt: "desc" }],
    take: 10,
  })
  const [entityRuns, totalEntityLeads, memorySize] = await Promise.all([
    db.agentRun.count({ where: { workspaceId: wsId, mode: "ENTITY" } }),
    db.agentRun.aggregate({ where: { workspaceId: wsId, mode: "ENTITY" }, _sum: { leadsCreated: true } }),
    db.searchMemory.count({ where: { workspaceId: wsId } }),
  ])

  return json({
    active: isEntityActive(wsId),
    activeRunId: entityRunId(wsId),
    run,
    steps,
    insights: insights.map((i) => ({ kind: i.kind, pattern: i.pattern, note: i.note, weight: i.weight, at: i.createdAt })),
    growth: {
      runs: entityRuns,
      totalLeads: totalEntityLeads._sum.leadsCreated ?? 0,
      memories: memorySize,
    },
  })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const wsId = auth.workspace.id
  if (isEntityActive(wsId)) return jsonError("الكيان شغال حاليًا على هدف — أوقفه أولًا أو استنى يخلص", 409)

  const body = await readBody<{ goal?: string; max_steps?: number; max_minutes?: number }>(req)
  const goal = (body?.goal ?? "").trim()
  if (goal.length < 6) return jsonError("اكتب هدفًا واضحًا للكيان (6 أحرف على الأقل)", 400)
  if (goal.length > 300) return jsonError("الهدف طويل جدًا (الحد 300 حرف)", 400)

  const started = await startEntity(wsId, auth.user.id, {
    goal,
    maxSteps: Number(body?.max_steps) || undefined,
    maxMinutes: Number(body?.max_minutes) || undefined,
  })
  if (!started) return jsonError("تعذر بدء الكيان (مشغول حاليًا)", 409)
  return json({ ok: true, runId: started.runId })
}

export async function DELETE() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const stopped = requestEntityStop(auth.workspace.id)
  if (!stopped) return jsonError("لا يوجد كيان شغال حاليًا", 404)
  return json({ ok: true, note: "إشارة الإيقاف وصلت — الكيان هيختم بخلاصة ويحفظ دروسه" })
}
