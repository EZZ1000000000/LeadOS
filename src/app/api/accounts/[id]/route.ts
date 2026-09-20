// LeadOS — تعديل/حذف حساب منصة (multi-account)
import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const existing = await db.platformAccount.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("الحساب غير موجود", 404)
  const body = await readBody<{ status?: string; dailyLimit?: number; label?: string; notes?: string; resetCounter?: boolean }>(req)
  const account = await db.platformAccount.update({
    where: { id },
    data: {
      ...(body?.status ? { status: body.status as never } : {}),
      ...(body?.dailyLimit ? { dailyLimit: Math.max(1, Math.min(200, Number(body.dailyLimit))) } : {}),
      ...(body?.label !== undefined ? { label: body.label } : {}),
      ...(body?.notes !== undefined ? { notes: body.notes } : {}),
      ...(body?.resetCounter ? { sentToday: 0, cooldownUntil: null } : {}),
    },
  })
  return json({ account })
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const existing = await db.platformAccount.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("الحساب غير موجود", 404)
  await db.platformAccount.delete({ where: { id } })
  return json({ ok: true })
}
