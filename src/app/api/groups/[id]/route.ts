import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"

/** PATCH /api/groups/[id] — تعديل حالة/لوحة/ملاحظات جروب */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const body = await readBody<{ status?: string; segment?: string; notes?: string; name?: string }>(req)
  if (!body) return jsonError("بيانات ناقصة")

  const group = await db.monitoredGroup.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!group) return jsonError("الجروب غير موجود", 404)

  const data: { status?: string; segment?: string; notes?: string | null; name?: string; statusNote?: string | null } = {}
  if (body.status) {
    if (!["ACTIVE", "PAUSED", "ARCHIVED"].includes(body.status)) return jsonError("حالة غير مسموحة")
    data.status = body.status
    data.statusNote = body.status === "ACTIVE" ? null : group.statusNote
  }
  if (body.segment && ["CARDS", "AGENCY", "BOTH"].includes(body.segment)) data.segment = body.segment
  if (body.notes !== undefined) data.notes = body.notes?.slice(0, 500) ?? null
  if (body.name?.trim()) data.name = body.name.trim().slice(0, 90)

  const updated = await db.monitoredGroup.update({ where: { id }, data })
  return json({ group: updated })
}

/** DELETE /api/groups/[id] — حذف جروب ومعه كل منشوراته */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const group = await db.monitoredGroup.findFirst({ where: { id, workspaceId: auth.workspace.id }, select: { id: true } })
  if (!group) return jsonError("الجروب غير موجود", 404)
  await db.monitoredGroup.delete({ where: { id } })
  return json({ ok: true })
}
