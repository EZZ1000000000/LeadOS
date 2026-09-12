import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const lead = await db.lead.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!lead) return jsonError("العميل غير موجود", 404)
  const body = await readBody<{ title?: string; description?: string; dueAt?: string; type?: string }>(req)
  if (!body?.title?.trim()) return jsonError("عنوان المهمة مطلوب")
  const task = await db.task.create({
    data: {
      workspaceId: auth.workspace.id,
      leadId: id,
      assignedToId: auth.user.id,
      title: body.title.trim(),
      description: body.description,
      dueAt: body.dueAt ? new Date(body.dueAt) : new Date(Date.now() + 86400000),
    },
  })
  return json({ task }, 201)
}
