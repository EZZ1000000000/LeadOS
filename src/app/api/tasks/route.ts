import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const url = new URL(req.url)
  const status = url.searchParams.get("status")
  const tasks = await db.task.findMany({
    where: {
      workspaceId: auth.workspace.id,
      ...(status && status !== "ALL" ? { status: status as never } : {}),
    },
    include: { lead: { include: { business: { select: { name: true } } } }, assignedTo: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    take: 60,
  })
  return json({ tasks })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = await readBody<{ title?: string; leadId?: string; dueAt?: string; description?: string }>(req)
  if (!body?.title?.trim()) return jsonError("عنوان المهمة مطلوب")
  const task = await db.task.create({
    data: {
      workspaceId: auth.workspace.id,
      title: body.title.trim(),
      description: body.description,
      leadId: body.leadId,
      assignedToId: auth.user.id,
      dueAt: body.dueAt ? new Date(body.dueAt) : new Date(Date.now() + 86400000),
    },
  })
  return json({ task }, 201)
}
