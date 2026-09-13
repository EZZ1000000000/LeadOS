// LeadOS — Remove ALL fake/demo customer data, keep system config.
// Keeps: users, workspace+members, pipeline+stages, sources, search rules+actions,
//        automations, aiProviderConfig.
// Deletes: every business/lead/research/content/job/alert/chat/analytics record.
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  console.log("Cleaning fake demo data (keeping users/workspace/sources/rules)...")
  const res: Array<[string, number]> = []
  const del = async (name: string, fn: () => Promise<{ count: number }>) => {
    const r = await fn()
    res.push([name, r.count])
  }

  await del("auditLog", () => db.auditLog.deleteMany({}))
  await del("alert", () => db.alert.deleteMany({}))
  await del("job", () => db.job.deleteMany({}))
  await del("aiChatMessage", () => db.aiChatMessage.deleteMany({}))
  await del("aiChatSession", () => db.aiChatSession.deleteMany({}))
  await del("aiRun", () => db.aiRun.deleteMany({}))
  await del("competitor", () => db.competitor.deleteMany({}))
  await del("contactList", () => db.contactList.deleteMany({}))
  await del("savedView", () => db.savedView.deleteMany({}))
  await del("leadTag", () => db.leadTag.deleteMany({}))
  await del("tag", () => db.tag.deleteMany({}))
  await del("note", () => db.note.deleteMany({}))
  await del("task", () => db.task.deleteMany({}))
  await del("activity", () => db.activity.deleteMany({}))
  await del("deal", () => db.deal.deleteMany({}))
  await del("opportunity", () => db.opportunity.deleteMany({}))
  await del("finding", () => db.finding.deleteMany({}))
  await del("researchRun", () => db.researchRun.deleteMany({}))
  await del("leadSource", () => db.leadSource.deleteMany({}))
  await del("leadContent", () => db.leadContent.deleteMany({}))
  await del("lead", () => db.lead.deleteMany({}))
  await del("person", () => db.person.deleteMany({}))
  await del("review", () => db.review.deleteMany({}))
  await del("socialProfile", () => db.socialProfile.deleteMany({}))
  await del("websitePage", () => db.websitePage.deleteMany({}))
  await del("website", () => db.website.deleteMany({}))
  await del("businessSource", () => db.businessSource.deleteMany({}))
  await del("branch", () => db.branch.deleteMany({}))
  await del("business", () => db.business.deleteMany({}))
  await del("contentItem", () => db.contentItem.deleteMany({}))
  await del("searchJob", () => db.searchJob.deleteMany({}))

  console.log("Deleted records:")
  for (const [name, count] of res) console.log(`  ${name}: ${count}`)
  const users = await db.user.count()
  const sources = await db.source.count()
  const rules = await db.searchRule.count()
  console.log(`\nKept: users=${users}, sources=${sources}, rules=${rules}`)
  console.log("Done — the database now contains ZERO fake customers.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
