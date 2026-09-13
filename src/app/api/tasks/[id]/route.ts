import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const existing = await db.task.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("المهمة غير موجودة", 404)
  const body = await readBody<{ status?: string; title?: string; dueAt?: string }>(req)
  const task = await db.task.update({
    where: { id },
    data: {
      ...(body?.status ? { status: body.status as never, ...(body.status === "DONE" ? { completedAt: new Date() } : {}) } : {}),
      ...(body?.title ? { title: body.title } : {}),
      ...(body?.dueAt ? { dueAt: new Date(body.dueAt) } : {}),
    },
  })
  return json({ task })
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const existing = await db.task.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("المهمة غير موجودة", 404)
  await db.task.delete({ where: { id } })
  return json({ ok: true })
}
