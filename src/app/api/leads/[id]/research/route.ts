import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse } from "@/lib/api-helpers"
import { enqueueJob } from "@/lib/queue"

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const lead = await db.lead.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!lead) return jsonError("العميل غير موجود", 404)

  let depth = "DEEP"
  try {
    const body = (await req.json()) as { depth?: string }
    if (body?.depth && ["QUICK", "DEEP", "ULTRA_DEEP"].includes(body.depth)) depth = body.depth
  } catch { /* optional body */ }

  const run = await db.researchRun.create({
    data: {
      workspaceId: auth.workspace.id,
      leadId: id,
      depth: depth as never,
      requestedById: auth.user.id,
      status: "QUEUED",
      scoreBefore: lead.score,
    },
  })
  await enqueueJob(auth.workspace.id, "DEEP_RESEARCH", { researchRunId: run.id, leadId: id }, 80)
  await db.activity.create({
    data: {
      workspaceId: auth.workspace.id, leadId: id, userId: auth.user.id,
      type: "AI_ACTION", subject: "بحث عميق",
      body: `بدأ بحث عميق (${depth}) بواسطة ${auth.user.name || auth.user.email}`,
    },
  })
  return json({ researchRunId: run.id }, 201)
}
