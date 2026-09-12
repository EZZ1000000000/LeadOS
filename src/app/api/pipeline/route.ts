import { db } from "@/lib/db"
import { json, requireAuth, isResponse, readBody } from "@/lib/api-helpers"

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const wsId = auth.workspace.id

  const pipeline = await db.pipeline.findFirst({
    where: { workspaceId: wsId },
    include: { stages: { orderBy: { position: "asc" } } },
  })

  // Map lead status → stage name (Arabic labels match DEFAULT_STAGES)
  const { LEAD_STATUS_LABELS, PIPELINE_ORDER } = await import("@/lib/constants")
  const statusToStage: Record<string, string> = {}
  PIPELINE_ORDER.forEach((st) => { statusToStage[st] = LEAD_STATUS_LABELS[st] ?? st })

  const leads = await db.lead.findMany({
    where: { workspaceId: wsId, status: { notIn: ["ARCHIVED"] } },
    include: {
      business: { select: { name: true, city: true, industry: true } },
      opportunities: { select: { title: true, score: true }, take: 2 },
    },
    orderBy: { score: "desc" },
    take: 200,
  })

  const stages = (pipeline?.stages ?? []).map((stage) => ({
    ...stage,
    leads: leads
      .filter((l) => statusToStage[l.status] === stage.name)
      .map((l) => ({
        id: l.id, score: l.score, temperature: l.temperature, intent: l.intent,
        company: l.business?.name, city: l.business?.city, industry: l.business?.industry,
        opportunities: l.opportunities, updatedAt: l.updatedAt,
      })),
  }))
  const unmatched = leads.filter((l) => !stages.some((s) => s.leads.some((sl) => sl.id === l.id)))
  return json({ pipeline: pipeline?.name ?? "خط المبيعات", stages, unmatchedCount: unmatched.length })
}

export async function PATCH(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = await readBody<{ leadId?: string; status?: string }>(req)
  if (!body?.leadId || !body?.status) return json({ error: "leadId و status مطلوبان" }, 400)
  const lead = await db.lead.findFirst({ where: { id: body.leadId, workspaceId: auth.workspace.id } })
  if (!lead) return json({ error: "العميل غير موجود" }, 404)

  const updated = await db.lead.update({
    where: { id: body.leadId },
    data: { status: body.status as never, ...(body.status === "WON" ? { convertedAt: new Date() } : {}) },
  })
  await db.activity.create({
    data: {
      workspaceId: auth.workspace.id, leadId: lead.id, userId: auth.user.id,
      type: "STATUS_CHANGE", subject: "نقل في الـPipeline",
      body: `من ${lead.status} إلى ${body.status}`,
    },
  })
  return json({ lead: updated })
}
