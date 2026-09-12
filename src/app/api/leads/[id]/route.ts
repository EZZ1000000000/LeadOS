import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { asArray } from "@/lib/constants"
import { recomputeLeadScore } from "@/lib/scoring"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params

  const lead = await db.lead.findFirst({
    where: { id, workspaceId: auth.workspace.id },
    include: {
      business: {
        include: {
          websites: true,
          socialProfiles: true,
          reviews: { orderBy: { publishedAt: "desc" }, take: 20 },
          branches: true,
          businessSources: true,
        },
      },
      person: true,
      assignedTo: { select: { id: true, name: true } },
      contentLinks: { include: { content: true }, orderBy: { createdAt: "desc" } },
      researchRuns: { orderBy: { createdAt: "desc" } },
      findings: { orderBy: { createdAt: "desc" }, take: 40 },
      opportunities: { orderBy: { score: "desc" } },
      tasks: { orderBy: { dueAt: "asc" } },
      notes: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
      activities: { orderBy: { occurredAt: "desc" }, take: 50 },
      sourceLinks: true,
      tags: { include: { tag: true } },
    },
  })
  if (!lead) return jsonError("العميل غير موجود", 404)

  const findingsByStage: Record<string, typeof lead.findings> = {}
  for (const f of lead.findings) {
    const key = f.category ?? "general"
    ;(findingsByStage[key] ??= []).push(f)
  }
  // Normalize Json array fields for the client
  const leadNormalized = {
    ...lead,
    serviceNeeds: asArray(lead.serviceNeeds),
    painPoints: asArray(lead.painPoints),
    business: lead.business
      ? {
          ...lead.business,
          reviews: lead.business.reviews.map((r) => ({ ...r, painPoints: asArray(r.painPoints) })),
          websites: lead.business.websites.map((w) => ({
            ...w,
            technologies: asArray(w.technologies),
            analyticsTools: asArray(w.analyticsTools),
            auditData: (w.auditData ?? null) as { issues?: string[] } | null,
          })),
        }
      : null,
  }
  return json({ lead: leadNormalized, findingsByStage })
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const body = await readBody<{
    status?: string; temperature?: string; assignedToId?: string | null
    nextFollowUpAt?: string | null; serviceNeeds?: string[]; summary?: string
    whyNow?: string; nextBestAction?: string; intent?: string
  }>(req)
  const existing = await db.lead.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("العميل غير موجود", 404)

  const data: Prisma.LeadUpdateInput = {}
  if (body?.status) data.status = body.status as never
  if (body?.temperature) data.temperature = body.temperature as never
  if (body?.intent) data.intent = body.intent as never
  if (body?.assignedToId !== undefined) {
    data.assignedTo = body.assignedToId ? { connect: { id: body.assignedToId } } : { disconnect: true }
  }
  if (body?.nextFollowUpAt !== undefined) data.nextFollowUpAt = body.nextFollowUpAt ? new Date(body.nextFollowUpAt) : null
  if (body?.serviceNeeds) data.serviceNeeds = body.serviceNeeds as unknown as Prisma.InputJsonValue
  if (body?.summary !== undefined) data.summary = body.summary
  if (body?.whyNow !== undefined) data.whyNow = body.whyNow
  if (body?.nextBestAction !== undefined) data.nextBestAction = body.nextBestAction
  if (body?.status && body.status === "WON") data.convertedAt = new Date()
  if (body?.status && body.status === "CONTACTED") data.lastContactedAt = new Date()

  const updated = await db.lead.update({ where: { id }, data })
  if (body?.status) {
    await db.activity.create({
      data: {
        workspaceId: auth.workspace.id, leadId: id, userId: auth.user.id,
        type: "STATUS_CHANGE", subject: "تغيير المرحلة",
        body: `من "${existing.status}" إلى "${body.status}" بواسطة ${auth.user.name || auth.user.email}`,
      },
    })
  }
  await recomputeLeadScore(id)
  return json({ lead: updated })
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const existing = await db.lead.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("العميل غير موجود", 404)
  await db.lead.delete({ where: { id } })
  return json({ ok: true })
}
