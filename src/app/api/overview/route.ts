import { db } from "@/lib/db"
import { json, requireAuth, isResponse } from "@/lib/api-helpers"

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const wsId = auth.workspace.id

  const [hotLeads, newLeads, runningResearch, unreadAlerts, dueTasks, activeSources, totalLeads, totalJobs] =
    await Promise.all([
      db.lead.count({ where: { workspaceId: wsId, temperature: "HOT" } }),
      db.lead.count({ where: { workspaceId: wsId, status: "NEW" } }),
      db.researchRun.count({ where: { workspaceId: wsId, status: { in: ["RUNNING", "QUEUED"] } } }),
      db.alert.count({ where: { workspaceId: wsId, isRead: false } }),
      db.task.count({ where: { workspaceId: wsId, status: "TODO" } }),
      db.source.count({ where: { workspaceId: wsId, status: "ACTIVE" } }),
      db.lead.count({ where: { workspaceId: wsId } }),
      db.job.count({ where: { workspaceId: wsId, status: { in: ["QUEUED", "RUNNING", "RETRYING"] } } }),
    ])

  const topLeads = await db.lead.findMany({
    where: { workspaceId: wsId },
    include: { business: { select: { name: true, city: true, industry: true } } },
    orderBy: { score: "desc" },
    take: 5,
  })
  const recentAlerts = await db.alert.findMany({
    where: { workspaceId: wsId },
    orderBy: { createdAt: "desc" },
    take: 5,
  })
  const sources = await db.source.findMany({
    where: { workspaceId: wsId },
    select: { id: true, name: true, type: true, status: true, lastRunAt: true, lastError: true },
    take: 8,
  })
  const recentJobs = await db.job.findMany({
    where: { workspaceId: wsId },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { id: true, type: true, status: true, createdAt: true, result: true },
  })
  const upcomingTasks = await db.task.findMany({
    where: { workspaceId: wsId, status: "TODO" },
    include: { lead: { include: { business: { select: { name: true } } } } },
    orderBy: { dueAt: "asc" },
    take: 5,
  })

  return json({
    kpis: { hotLeads, newLeads, runningResearch, unreadAlerts, dueTasks, activeSources, totalLeads, activeJobs: totalJobs },
    topLeads,
    recentAlerts,
    sources,
    recentJobs,
    upcomingTasks,
  })
}
