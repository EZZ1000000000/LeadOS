// LeadOS — حسابات المنصات المتعددة (multi-account) API
// كل حساب = كوتية يومية مستقلة — التوزيع التلقائي بيحصل في gate.ts وقت الإرسال
import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"

const PLATFORMS = ["WHATSAPP", "FACEBOOK", "INSTAGRAM", "TELEGRAM", "LINKEDIN", "X"]

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const accounts = await db.platformAccount.findMany({
    where: { workspaceId: auth.workspace.id },
    orderBy: [{ platform: "asc" }, { createdAt: "asc" }],
  })
  return json({ accounts })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = await readBody<{ platform?: string; handle?: string; label?: string; dailyLimit?: number; status?: string; notes?: string }>(req)
  const platform = (body?.platform ?? "").toUpperCase()
  const handle = body?.handle?.trim()
  if (!PLATFORMS.includes(platform)) return jsonError(`المنصة مطلوبة — المتاح: ${PLATFORMS.join("، ")}`)
  if (!handle) return jsonError("معرّف الحساب (رقم/يوزر) مطلوب")
  const account = await db.platformAccount.upsert({
    where: { workspaceId_platform_handle: { workspaceId: auth.workspace.id, platform, handle } },
    update: {
      ...(body?.label !== undefined ? { label: body.label } : {}),
      ...(body?.dailyLimit ? { dailyLimit: Math.max(1, Math.min(200, Number(body.dailyLimit))) } : {}),
      ...(body?.status ? { status: body.status as never } : {}),
      ...(body?.notes !== undefined ? { notes: body.notes } : {}),
    },
    create: {
      workspaceId: auth.workspace.id,
      platform: platform as never,
      handle,
      label: body?.label,
      dailyLimit: Math.max(1, Math.min(200, Number(body?.dailyLimit ?? 20))),
      status: (body?.status ?? "WARMING") as never,
      notes: body?.notes,
    },
  })
  return json({ account }, 201)
}
