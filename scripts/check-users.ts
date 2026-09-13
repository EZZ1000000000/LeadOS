// فحص المستخدمين ومساحات العمل في Neon
import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()
async function main() {
  const users = await db.user.findMany({ select: { id: true, email: true, name: true, role: true, createdAt: true } })
  const wss = await db.workspace.findMany({ select: { id: true, name: true, slug: true, createdAt: true, _count: { select: { members: true, leads: true } } } })
  console.log("USERS:", JSON.stringify(users, null, 1))
  console.log("WORKSPACES:", JSON.stringify(wss.map((w) => ({ ...w, _count: undefined, members: w._count.members, leads: w._count.leads })), null, 1))
  await db.$disconnect()
}
main()
