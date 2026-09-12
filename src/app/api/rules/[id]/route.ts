import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const existing = await db.searchRule.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("القاعدة غير موجودة", 404)
  const body = await readBody<{
    name?: string; description?: string; enabled?: boolean; cities?: string[]
    industries?: string[]; services?: string[]; keywords?: string[]; excludedWords?: string[]
    sourceTypes?: string[]; minLeadScore?: number; researchDepth?: string
    startResearch?: boolean; priority?: number
  }>(req)

  const arr = (v?: string[]) => (v ? (v as unknown as Prisma.InputJsonValue) : undefined)
  const rule = await db.searchRule.update({
    where: { id },
    data: {
      ...(body?.name ? { name: body.name } : {}),
      ...(body?.description !== undefined ? { description: body.description } : {}),
      ...(body?.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(body?.cities ? { cities: arr(body.cities) } : {}),
      ...(body?.industries ? { industries: arr(body.industries) } : {}),
      ...(body?.services ? { services: arr(body.services) } : {}),
      ...(body?.keywords ? { keywords: arr(body.keywords) } : {}),
      ...(body?.excludedWords ? { excludedWords: arr(body.excludedWords) } : {}),
      ...(body?.sourceTypes ? { sourceTypes: arr(body.sourceTypes) } : {}),
      ...(body?.minLeadScore !== undefined ? { minLeadScore: body.minLeadScore } : {}),
      ...(body?.researchDepth ? { researchDepth: body.researchDepth as never } : {}),
      ...(body?.startResearch !== undefined ? { startResearch: body.startResearch } : {}),
      ...(body?.priority !== undefined ? { priority: body.priority } : {}),
    },
  })
  return json({ rule })
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const existing = await db.searchRule.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("القاعدة غير موجودة", 404)
  await db.searchRule.delete({ where: { id } })
  return json({ ok: true })
}
