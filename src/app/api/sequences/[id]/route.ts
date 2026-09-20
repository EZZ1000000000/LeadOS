// LeadOS — تفعيل/حذف سلسلة
import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const existing = await db.sequence.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("السلسلة غير موجودة", 404)
  const body = await readBody<{ enabled?: boolean; name?: string }>(req)
  const sequence = await db.sequence.update({
    where: { id },
    data: {
      ...(typeof body?.enabled === "boolean" ? { enabled: body.enabled } : {}),
      ...(body?.name ? { name: body.name } : {}),
    },
  })
  return json({ sequence })
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const existing = await db.sequence.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("السلسلة غير موجودة", 404)
  await db.sequence.delete({ where: { id } })
  return json({ ok: true })
}
