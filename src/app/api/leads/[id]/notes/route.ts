import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const lead = await db.lead.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!lead) return jsonError("العميل غير موجود", 404)
  const body = await readBody<{ body?: string; isPrivate?: boolean }>(req)
  if (!body?.body?.trim()) return jsonError("نص الملاحظة مطلوب")
  const note = await db.note.create({
    data: {
      workspaceId: auth.workspace.id,
      leadId: id,
      userId: auth.user.id,
      body: body.body.trim(),
      isPrivate: body.isPrivate ?? false,
    },
  })
  await db.activity.create({
    data: { workspaceId: auth.workspace.id, leadId: id, userId: auth.user.id, type: "NOTE", subject: "ملاحظة", body: body.body.slice(0, 200) },
  })
  return json({ note }, 201)
}
