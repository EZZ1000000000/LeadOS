import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse } from "@/lib/api-helpers"
import { temperatureFromScore } from "@/lib/constants"
import { detectServiceKeys } from "@/lib/monitors/segments"

/**
 * POST /api/groups/posts/[id]/convert — تحويل منشور جروب لعميل في اللوحة الصح
 * قاعدة المستخدم: الكافيه بدون خدمة أجنسي → لوحة الكروت؛ لو البوست فيه خدمة أجنسي → BOTH.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const wsId = auth.workspace.id
  const { id } = await params

  const post = await db.groupPost.findFirst({
    where: { id, group: { workspaceId: wsId } },
    include: { group: { select: { id: true, name: true, platform: true, url: true } } },
  })
  if (!post) return jsonError("المنشور غير موجود", 404)
  if (post.leadId) {
    const lead = await db.lead.findUnique({ where: { id: post.leadId }, include: { business: true } })
    return json({ lead, already: true })
  }

  const services = detectServiceKeys(post.content)
  const isCafe = /كافيه|كافي|قهوه|كوفي|مقهى|مقاهي|coffee|cafe/i.test(`${post.content} ${post.group.name}`)
  const hasAgencyNeed = services.length > 0
  const segment = isCafe ? (hasAgencyNeed ? "BOTH" : "CARDS") : "AGENCY"

  const name = (post.author?.trim() || `عميل من ${post.group.name}`).slice(0, 90)
  const business = await db.business.create({
    data: {
      workspaceId: wsId,
      name,
      category: isCafe ? "cafe" : null,
      industry: isCafe ? "cafe" : null,
      metadata: { fromGroupPost: true } as never,
    },
  })

  const score = Math.max(40, post.score)
  const lead = await db.lead.create({
    data: {
      workspaceId: wsId,
      businessId: business.id,
      leadSourceType: "SOCIAL",
      segment,
      status: "NEW",
      temperature: temperatureFromScore(score),
      intent: score >= 80 ? "VERY_HIGH" : score >= 60 ? "HIGH" : "MEDIUM",
      score,
      intentScore: score,
      confidenceScore: 60,
      serviceNeeds: services,
      summary: post.content.slice(0, 400),
      whyNow: `منشور حديث في «${post.group.name}» (${post.group.platform})`,
      nextBestAction: "تواصل مع صاحب المنشور واعرض الحل المناسب",
      metadata: {
        groupPostId: post.id,
        groupId: post.group.id,
        groupName: post.group.name,
        groupUrl: post.group.url,
        platform: post.group.platform,
        postUrl: post.url,
        author: post.author,
      } as never,
    },
  })

  await db.leadSource.create({
    data: {
      leadId: lead.id,
      sourceType: post.group.platform === "FACEBOOK" ? "FACEBOOK" : post.group.platform === "REDDIT" ? "REDDIT" : post.group.platform === "TELEGRAM" ? "TELEGRAM" : "OTHER",
      sourceUrl: post.url ?? post.group.url,
      label: `جروب: ${post.group.name}`,
    },
  })

  await db.groupPost.update({ where: { id: post.id }, data: { status: "CONVERTED", leadId: lead.id } })
  await db.activity.create({
    data: {
      workspaceId: wsId,
      leadId: lead.id,
      userId: auth.user.id,
      type: "SYSTEM",
      subject: "تحويل من جروب",
      body: `اتحوّل من منشور في «${post.group.name}»`,
    },
  })

  const fresh = await db.lead.findUnique({ where: { id: lead.id }, include: { business: true } })
  return json({ lead: fresh }, 201)
}
