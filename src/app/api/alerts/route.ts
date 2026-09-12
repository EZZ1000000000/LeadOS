import { db } from "@/lib/db"
import { json, requireAuth, isResponse } from "@/lib/api-helpers"

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const alerts = await db.alert.findMany({
    where: { workspaceId: auth.workspace.id },
    orderBy: { createdAt: "desc" },
    take: 40,
  })
  const unread = alerts.filter((a) => !a.isRead).length
  return json({ alerts, unread })
}

/** Mark all (or one via body.id) as read. */
export async function PATCH(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  let id: string | undefined
  try {
    const body = (await req.json()) as { id?: string }
    id = body?.id
  } catch { /* mark all */ }
  await db.alert.updateMany({
    where: { workspaceId: auth.workspace.id, ...(id ? { id } : {}) },
    data: { isRead: true },
  })
  return json({ ok: true })
}
