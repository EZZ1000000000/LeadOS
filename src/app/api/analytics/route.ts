import { db } from "@/lib/db"
import { json, requireAuth, isResponse } from "@/lib/api-helpers"
import { asArray, serviceAr } from "@/lib/constants"

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const wsId = auth.workspace.id

  const [totalLeads, qualified, hot, bySourceRaw, byIndustryRaw, byCityRaw, byStatusRaw, avgScoreAgg, duplicateCount, researchTotal, researchCompleted, contacted, replied, meetings, proposals, won] =
    await Promise.all([
      db.lead.count({ where: { workspaceId: wsId } }),
      db.lead.count({ where: { workspaceId: wsId, status: { in: ["QUALIFIED", "CONTACTED", "REPLIED", "INTERESTED", "MEETING", "PROPOSAL", "WON"] } } }),
      db.lead.count({ where: { workspaceId: wsId, temperature: "HOT" } }),
      db.lead.groupBy({ by: ["leadSourceType"], where: { workspaceId: wsId }, _count: true, _avg: { score: true } }),
      db.lead.findMany({ where: { workspaceId: wsId }, select: { business: { select: { industry: true } } } }),
      db.lead.findMany({ where: { workspaceId: wsId }, select: { business: { select: { city: true } } } }),
      db.lead.groupBy({ by: ["status"], where: { workspaceId: wsId }, _count: true }),
      db.lead.aggregate({ where: { workspaceId: wsId }, _avg: { score: true } }),
      db.contentItem.count({ where: { workspaceId: wsId, status: "DUPLICATE" } }),
      db.researchRun.count({ where: { workspaceId: wsId } }),
      db.researchRun.count({ where: { workspaceId: wsId, status: "COMPLETED" } }),
      db.lead.count({ where: { workspaceId: wsId, status: { in: ["CONTACTED", "REPLIED", "INTERESTED", "MEETING", "PROPOSAL", "WON"] } } }),
      db.lead.count({ where: { workspaceId: wsId, status: { in: ["REPLIED", "INTERESTED", "MEETING", "PROPOSAL", "WON"] } } }),
      db.lead.count({ where: { workspaceId: wsId, status: { in: ["MEETING", "PROPOSAL", "WON"] } } }),
      db.lead.count({ where: { workspaceId: wsId, status: { in: ["PROPOSAL", "WON"] } } }),
      db.lead.count({ where: { workspaceId: wsId, status: "WON" } }),
    ])

  const countBy = (items: Array<{ business: { industry?: string | null; city?: string | null } | null }>, key: "industry" | "city") => {
    const map = new Map<string, number>()
    for (const item of items) {
      const v = item.business?.[key]
      if (!v) continue
      map.set(v, (map.get(v) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }))
  }

  const byService = new Map<string, number>()
  const serviceLeads = await db.lead.findMany({ where: { workspaceId: wsId }, select: { serviceNeeds: true } })
  for (const l of serviceLeads) {
    for (const s of asArray(l.serviceNeeds)) byService.set(s, (byService.get(s) ?? 0) + 1)
  }

  return json({
    funnel: { totalLeads, qualified, contacted, replied, meetings, proposals, won },
    rates: {
      contactRate: totalLeads ? Math.round((contacted / totalLeads) * 100) : 0,
      replyRate: contacted ? Math.round((replied / contacted) * 100) : 0,
      meetingRate: replied ? Math.round((meetings / replied) * 100) : 0,
      wonRate: totalLeads ? Math.round((won / totalLeads) * 100) : 0,
      researchCompletion: researchTotal ? Math.round((researchCompleted / researchTotal) * 100) : 0,
      duplicateRate: totalLeads + duplicateCount ? Math.round((duplicateCount / (totalLeads + duplicateCount)) * 100) : 0,
    },
    avgScore: Math.round(avgScoreAgg._avg.score ?? 0),
    hot,
    qualified,
    bySource: bySourceRaw.map((s) => ({ source: s.leadSourceType, count: s._count, avgScore: Math.round(s._avg.score ?? 0) })),
    byIndustry: countBy(byIndustryRaw, "industry"),
    byCity: countBy(byCityRaw, "city"),
    byService: [...byService.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([key, count]) => ({ name: serviceAr(key), count })),
    byStatus: byStatusRaw.map((s) => ({ status: s.status, count: s._count })),
  })
}
