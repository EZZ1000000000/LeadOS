import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const existing = await db.source.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("المصدر غير موجود", 404)
  const body = await readBody<{ status?: string; name?: string; scheduleCron?: string; config?: unknown }>(req)
  const source = await db.source.update({
    where: { id },
    data: {
      ...(body?.status ? { status: body.status as never } : {}),
      ...(body?.name ? { name: body.name } : {}),
      ...(body?.scheduleCron ? { scheduleCron: body.scheduleCron } : {}),
      ...(body?.config ? { config: body.config as never } : {}),
    },
  })
  return json({ source })
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const existing = await db.source.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("المصدر غير موجود", 404)
  await db.source.delete({ where: { id } })
  return json({ ok: true })
}
