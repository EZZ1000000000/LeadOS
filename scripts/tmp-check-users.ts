import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()
async function main() {
  const users = await db.user.findMany({ select: { email: true, name: true, role: true } })
  const ws = await db.workspace.findMany({ select: { id: true, name: true, slug: true } })
  const leads = await db.lead.count()
  const groups = await db.monitoredGroup.count()
  console.log(JSON.stringify({ users, ws, leads, groups }))
}
main().then(() => process.exit(0))
