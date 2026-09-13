// عدّ سريع لبيانات Neon بعد السيد
import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()
async function main() {
  const [users, ws, leads, biz, src, content, alerts, tasks, research, aiRuns, leadSrc] = await Promise.all([
    db.user.count(), db.workspace.count(), db.lead.count(), db.business.count(), db.source.count(),
    db.contentItem.count(), db.alert.count(), db.task.count(), db.researchRun.count(), db.aiRun.count(),
    db.leadSource.count(),
  ])
  console.log(JSON.stringify({ users, workspaces: ws, leads, businesses: biz, sources: src, contentItems: content, alerts, tasks, researchRuns: research, aiRuns, leadSources: leadSrc }, null, 0))
  await db.$disconnect()
}
main()
