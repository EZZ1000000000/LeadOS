import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse } from "@/lib/api-helpers"

type Params = { params: Promise<{ sessionId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { sessionId } = await params
  const session = await db.aiChatSession.findFirst({
    where: { id: sessionId, workspaceId: auth.workspace.id },
  })
  if (!session) return jsonError("الجلسة غير موجودة", 404)
  const messages = await db.aiChatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  })
  return json({ session, messages })
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { sessionId } = await params
  const session = await db.aiChatSession.findFirst({ where: { id: sessionId, workspaceId: auth.workspace.id } })
  if (!session) return jsonError("الجلسة غير موجودة", 404)
  await db.aiChatSession.delete({ where: { id: sessionId } })
  return json({ ok: true })
}
