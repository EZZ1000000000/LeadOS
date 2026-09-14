import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { parseGroupInput } from "@/lib/monitors/fetchers"
import { scoreGroupName } from "@/lib/monitors/segments"
import type { Prisma } from "@prisma/client"

const SEGMENT_VALUES = new Set(["CARDS", "AGENCY", "BOTH"])

/** GET /api/groups?panel=&platform=&status= — قائمة الجروبات المراقبة + حالة التكاملات */
export async function GET(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const wsId = auth.workspace.id
  const url = new URL(req.url)
  const panel = url.searchParams.get("panel")
  const platform = url.searchParams.get("platform")
  const status = url.searchParams.get("status")

  const where: Prisma.MonitoredGroupWhereInput = { workspaceId: wsId }
  if (panel === "CARDS") where.segment = { in: ["CARDS", "BOTH"] }
  if (panel === "AGENCY") where.segment = { in: ["AGENCY", "BOTH"] }
  if (platform && platform !== "ALL") where.platform = platform
  if (status && status !== "ALL") where.status = status

  const groups = await db.monitoredGroup.findMany({
    where,
    orderBy: [{ activityScore: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      _count: { select: { posts: { where: { status: { in: ["NEW", "QUALIFIED"] } } } } },
    },
  })

  const [pendingPosts, convertedPosts] = await Promise.all([
    db.groupPost.count({ where: { group: { workspaceId: wsId }, status: { in: ["NEW", "QUALIFIED"] } } }),
    db.groupPost.count({ where: { group: { workspaceId: wsId }, status: "CONVERTED" } }),
  ])

  return json({
    groups: groups.map((g) => ({ ...g, pendingPosts: g._count.posts })),
    meta: {
      facebookSession: Boolean(process.env.FACEBOOK_SESSION_COOKIE),
      apify: Boolean(process.env.APIFY_TOKEN),
      pendingPosts,
      convertedPosts,
    },
  })
}

/** POST /api/groups — إضافة جروب يدويًا من رابط */
export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const wsId = auth.workspace.id
  const body = await readBody<{ url?: string; xKeyword?: string; name?: string; segment?: string }>(req)
  if (!body?.url && !body?.xKeyword) return jsonError("رابط الجروب أو كلمة X مطلوبة")

  const parsed = parseGroupInput(body.url ?? "", body.xKeyword)
  if (!parsed) return jsonError("الرابط مش مفهوم — مدعوم: facebook.com/groups/… أو t.me/… أو reddit.com/r/… أو x:كلمة")

  const segment = body.segment && SEGMENT_VALUES.has(body.segment) ? body.segment : "BOTH"
  const existing = await db.monitoredGroup.findFirst({
    where: { workspaceId: wsId, platform: parsed.platform, externalId: parsed.externalId },
    select: { id: true },
  })
  if (existing) return jsonError("الجروب ده متضاف قبل كده")

  const group = await db.monitoredGroup.create({
    data: {
      workspaceId: wsId,
      platform: parsed.platform,
      externalId: parsed.externalId,
      url: parsed.url,
      name: body.name?.trim().slice(0, 90) || parsed.externalId,
      segment,
      intentScore: scoreGroupName(body.name ?? parsed.externalId),
    },
  })
  return json({ group }, 201)
}
