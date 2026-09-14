import { db } from "@/lib/db"
import { json, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { scanGroup, scanDueGroups } from "@/lib/monitors/scan"

/**
 * POST /api/groups/scan — مسح الجروبات
 * body: { groupId } → مسح جروب واحد | {} → مسح المستحق (حتى 4 جروبات)
 * يدعم كذلك cron secret زي /api/cron/tick.
 */
async function handle(req: Request) {
  // مصادقة: جلسة مستخدم أو cron secret
  const url = new URL(req.url)
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization") ?? ""
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null
  const provided = req.headers.get("x-cron-secret") ?? bearer ?? url.searchParams.get("secret")
  const auth = await requireAuth()
  const authorized = isResponse(auth) ? (secret && provided === secret) : true
  if (!authorized) return json({ error: "غير مصرح" }, 401)

  const workspaceId = isResponse(auth) ? null : auth.workspace.id
  const wsId = workspaceId ?? (url.searchParams.get("workspaceId") ?? undefined) ?? undefined
  if (!wsId) return json({ error: "لا توجد مساحة عمل" }, 403)

  const body = await readBody<{ groupId?: string }>(req).catch(() => null)

  if (body?.groupId) {
    const group = await db.monitoredGroup.findFirst({
      where: { id: body.groupId, workspaceId: wsId },
      select: { id: true, workspaceId: true, platform: true, name: true, externalId: true, url: true },
    })
    if (!group) return json({ error: "الجروب غير موجود" }, 404)
    const outcome = await scanGroup(group)
    return json({ results: [outcome] })
  }

  const results = await scanDueGroups(wsId, 4)
  return json({ results, scanned: results.length, newPosts: results.reduce((a, r) => a + r.newPosts, 0) })
}

export async function POST(req: Request) {
  return handle(req)
}

export async function GET(req: Request) {
  return handle(req)
}
