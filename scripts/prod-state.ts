// فحص شامل لحالة قاعدة الإنتاج (Neon): users / leads / rules / sources / stages
import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()

async function main() {
  const [users, ws, leads, biz, src, rules, content, stages, jobs, pipeline] = await Promise.all([
    db.user.count(), db.workspace.count(), db.lead.count(), db.business.count(),
    db.source.count(), db.searchRule.count(), db.contentItem.count(),
    (db as { pipelineStage?: { count: () => Promise<number> } }).pipelineStage?.count?.() ?? Promise.resolve(-1),
    db.job.count(), (db as { stage?: { count: () => Promise<number> } }).stage?.count?.() ?? Promise.resolve(-1),
  ])
  console.log("== COUNTS ==")
  console.log(JSON.stringify({ users, workspaces: ws, leads, businesses: biz, sources: src, searchRules: rules, contentItems: content, pipelineStages: stages, jobs, stageAlt: pipeline }))

  console.log("== USERS ==")
  const us = await db.user.findMany({ select: { email: true, name: true, role: true, createdAt: true } })
  for (const u of us) console.log(`- ${u.email} | ${u.name ?? "-"} | ${String(u.role)}`)

  console.log("== SEARCH RULES ==")
  const rs = await db.searchRule.findMany({ select: { id: true, name: true, enabled: true, priority: true, sourceTypes: true, industries: true, services: true, keywords: true, cities: true } })
  for (const r of rs) console.log(`- [${r.enabled ? "ON" : "OFF"}] ${r.name} | src=${JSON.stringify(r.sourceTypes)} | ind=${JSON.stringify(r.industries)} | svc=${JSON.stringify(r.services)} | kw=${JSON.stringify(r.keywords ?? []).slice(0, 1)} | cities=${JSON.stringify(r.cities)}`)

  console.log("== SOURCES ==")
  const ss = await db.source.findMany({ select: { id: true, name: true, type: true, status: true } })
  for (const s of ss) console.log(`- ${s.name} | type=${s.type} | ${s.status}`)

  console.log("== LEADS BY TYPE ==")
  const byType = await db.lead.groupBy({ by: ["leadSourceType"], _count: { leadSourceType: true } })
  for (const t of byType) console.log(`- ${String(t.leadSourceType)}: ${t._count.leadSourceType}`)

  const stages2 = await (db as unknown as { pipelineStage?: { findMany: (a: unknown) => Promise<Array<{ id: string; name: string }>> } }).pipelineStage?.findMany?.({ take: 10 }) ?? []
  console.log("== PIPELINE STAGES ==")
  for (const s of stages2 as Array<{ id: string; name: string }>) console.log(`- ${s.name}`)

  await db.$disconnect()
}
main().catch((e) => { console.error("ERR:", e.message); process.exit(1) })
