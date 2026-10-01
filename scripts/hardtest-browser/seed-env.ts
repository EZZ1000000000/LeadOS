// LeadOS — بذر بيئة الاختبار المحلية: ورشة + مدير + مصدر (scrypt مثل auth.ts)
import { PrismaClient } from "@prisma/client"
import { scryptSync, randomBytes } from "crypto"

const db = new PrismaClient()
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return `scrypt$${salt}$${hash}`
}

async function main() {
  let ws = await db.workspace.findFirst()
  if (!ws) ws = await db.workspace.create({ data: { name: "LeadOS Test", slug: "leados-test" } })
  let admin = await db.user.findFirst({ where: { email: "admin@leados.com" } })
  if (!admin) {
    admin = await db.user.create({ data: { email: "admin@leados.com", name: "Admin", passwordHash: hashPassword("admin123"), role: "OWNER" } })
  }
  const member = await db.workspaceMember.findFirst({ where: { workspaceId: ws.id, userId: admin.id } })
  if (!member) {
    await db.workspaceMember.create({ data: { workspaceId: ws.id, userId: admin.id, role: "OWNER" } })
  }
  const src = await db.source.findFirst({ where: { workspaceId: ws.id } })
  if (!src) {
    await db.source.create({ data: { workspaceId: ws.id, name: "Browser Runtime Test", type: "WEB", status: "ACTIVE" } })
  }
  console.log("SEEDED:", { workspace: ws.id, admin: admin.email })
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
