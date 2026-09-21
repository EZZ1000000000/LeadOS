// LeadOS — فحص جاهزية الإنتاج الشامل (بيانات + أنظمة + تكاملات)
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  const [users, workspaces, sources, sourcesActive, rules, leads, hotLeads, content, jobs, monitoredGroups, groupPosts, aiRuns, insights, findings] = await Promise.all([
    db.user.count(),
    db.workspace.count(),
    db.source.count(),
    db.source.count({ where: { status: "ACTIVE" } }),
    db.searchRule.count({ where: { enabled: true } }),
    db.lead.count(),
    db.lead.count({ where: { score: { gte: 60 } } }),
    db.contentItem.count(),
    db.job.count(),
    db.monitoredGroup.count(),
    db.groupPost.count(),
    db.aiRun.count(),
    db.agentInsight.count(),
    db.finding.count(),
  ])

  console.log("=== حالة قاعدة البيانات ===")
  console.log(`users: ${users} | workspaces: ${workspaces}`)
  console.log(`sources: ${sources} (نشط: ${sourcesActive}) | rules: ${rules}`)
  console.log(`leads: ${leads} (ساخن ≥60: ${hotLeads}) | contentItems: ${content}`)
  console.log(`jobs: ${jobs} | monitoredGroups: ${monitoredGroups} | groupPosts: ${groupPosts}`)
  console.log(`aiRuns: ${aiRuns} | agentInsights: ${insights} | findings: ${findings}`)

  const env = {
    DAHL_API_KEY: !!process.env.DAHL_API_KEY,
    FACEBOOK_SESSION_COOKIE: !!process.env.FACEBOOK_SESSION_COOKIE,
    WHATSAPP_NUMBER: !!process.env.WHATSAPP_NUMBER,
    ZIZO_TELEGRAM: !!process.env.ZIZO_TELEGRAM,
    CRON_SECRET: !!process.env.CRON_SECRET,
    AUTH_SECRET: !!process.env.AUTH_SECRET,
  }
  console.log("\n=== متغيرات البيئة الحساسة ===")
  for (const [k, v] of Object.entries(env)) console.log(`${v ? "✅" : "❌"} ${k}`)

  await db.$disconnect()
}

main()
