import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()
async function main() {
  const jobs = await db.job.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { type: true, status: true, result: true, errorMessage: true, createdAt: true } })
  console.log("JOBS:", JSON.stringify(jobs, null, 1))
  const leads = await db.lead.count()
  const contents = await db.contentItem.count()
  const runs = await db.researchRun.count()
  const findgs = await db.finding.count()
  const opps = await db.opportunity.count()
  console.log({ leads, contents, runs, findgs, opps })
}
main().finally(() => db.$disconnect())
