// LeadOS — تحديث تجربة A/B: تسجيل رد/إغلاق على صيغة معينة أو إنهاء التجربة
// body: { recordReply?: number (variantIdx), recordWon?: number, status?: "RUNNING"|"DONE" }
import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"

type Params = { params: Promise<{ id: string }> }

interface AbVariant { name: string; template: string; sent: number; replied: number; won: number }

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const existing = await db.abExperiment.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("التجربة غير موجودة", 404)
  const body = await readBody<{ recordReply?: number; recordWon?: number; status?: string }>(req)
  const variants = (existing.variants as unknown as AbVariant[]) ?? []

  if (typeof body?.recordReply === "number" && variants[body.recordReply]) {
    variants[body.recordReply].replied = (variants[body.recordReply].replied ?? 0) + 1
  }
  if (typeof body?.recordWon === "number" && variants[body.recordWon]) {
    variants[body.recordWon].won = (variants[body.recordWon].won ?? 0) + 1
  }
  // تجربة وصلت 100 إرسال أو أكثر في كل الصيغ → تخلص تلقائيًا
  const allMatured = variants.length >= 2 && variants.every((v) => (v.sent ?? 0) >= 50)
  const experiment = await db.abExperiment.update({
    where: { id },
    data: {
      variants: variants as never,
      ...(body?.status ? { status: body.status as never } : allMatured ? { status: "DONE" as const } : {}),
    },
  })
  return json({ experiment })
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const existing = await db.abExperiment.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("التجربة غير موجودة", 404)
  await db.abExperiment.delete({ where: { id } })
  return json({ ok: true })
}
