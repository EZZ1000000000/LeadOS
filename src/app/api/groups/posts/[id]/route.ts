import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"

/** PATCH /api/groups/posts/[id] — تغيير حالة البوست (مؤهل/مرفوض) */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const body = await readBody<{ status?: string }>(req)
  if (!body?.status || !["NEW", "QUALIFIED", "REJECTED", "CONVERTED"].includes(body.status)) {
    return jsonError("حالة غير مسموحة")
  }
  const post = await db.groupPost.findFirst({
    where: { id, group: { workspaceId: auth.workspace.id } },
    select: { id: true },
  })
  if (!post) return jsonError("المنشور غير موجود", 404)
  const updated = await db.groupPost.update({ where: { id }, data: { status: body.status } })
  return json({ post: updated })
}

/** DELETE /api/groups/posts/[id] — حذف منشور */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const post = await db.groupPost.findFirst({
    where: { id, group: { workspaceId: auth.workspace.id } },
    select: { id: true },
  })
  if (!post) return jsonError("المنشور غير موجود", 404)
  await db.groupPost.delete({ where: { id } })
  return json({ ok: true })
}
