import { db } from "@/lib/db"
import { json, requireAuth, isResponse } from "@/lib/api-helpers"
import type { Prisma } from "@prisma/client"

/** GET /api/groups/posts?panel=&status=&minScore=&platform=&groupId=&limit= — بث منشورات الجروبات */
export async function GET(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const wsId = auth.workspace.id
  const url = new URL(req.url)
  const panel = url.searchParams.get("panel")
  const status = url.searchParams.get("status")
  const platform = url.searchParams.get("platform")
  const groupId = url.searchParams.get("groupId")
  const minScore = Number(url.searchParams.get("minScore") ?? 0)
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 60))

  const where: Prisma.GroupPostWhereInput = { group: { workspaceId: wsId } }
  if (panel === "CARDS") where.segment = { in: ["CARDS", "BOTH"] }
  if (panel === "AGENCY") where.segment = { in: ["AGENCY", "BOTH"] }
  if (status && status !== "ALL") where.status = status
  if (platform && platform !== "ALL") where.group = { ...where.group, platform }
  if (groupId) where.groupId = groupId
  if (minScore > 0) where.score = { gte: minScore }

  const posts = await db.groupPost.findMany({
    where,
    include: { group: { select: { id: true, name: true, platform: true, url: true, segment: true } } },
    orderBy: [{ detectedAt: "desc" }],
    take: limit,
  })

  const postSegWhere: Prisma.GroupPostWhereInput = panel === "CARDS"
    ? { segment: { in: ["CARDS", "BOTH"] } }
    : panel === "AGENCY"
      ? { segment: { in: ["AGENCY", "BOTH"] } }
      : {}

  const [newCount, qualifiedCount, convertedCount] = await Promise.all([
    db.groupPost.count({ where: { group: { workspaceId: wsId }, status: "NEW", ...postSegWhere } }),
    db.groupPost.count({ where: { group: { workspaceId: wsId }, status: "QUALIFIED", ...postSegWhere } }),
    db.groupPost.count({ where: { group: { workspaceId: wsId }, status: "CONVERTED", ...postSegWhere } }),
  ])

  return json({
    posts: posts.map((p) => ({ ...p, matchedKeywords: Array.isArray(p.matchedKeywords) ? p.matchedKeywords : [] })),
    counts: { new: newCount, qualified: qualifiedCount, converted: convertedCount },
  })
}
