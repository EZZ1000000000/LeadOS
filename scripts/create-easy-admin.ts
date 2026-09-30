// LeadOS — إنشاء حساب لوحة تحكم سهل الدخول (idempotent)
// admin@leados.com / admin123 — يُربط عضوًا في مساحة Sam الحالية ليرى كل البيانات
// الاستخدام: DATABASE_URL=postgres://… bun run scripts/create-easy-admin.ts
import { PrismaClient } from "@prisma/client"
import { hashPassword } from "../src/lib/auth"

const db = new PrismaClient()
const EMAIL = "admin@leados.com"
const PASSWORD = "admin123"

async function main() {
  const anchor = await db.user.findUnique({ where: { email: "samgany278@gmail.com" } })
  const membership = anchor
    ? await db.workspaceMember.findFirst({ where: { userId: anchor.id } })
    : null
  if (!membership) {
    console.error("لا توجد مساحة مرجعية — شغّل rescue-user-workspace.ts أولًا")
    process.exit(1)
  }

  let user = await db.user.findUnique({ where: { email: EMAIL } })
  if (!user) {
    user = await db.user.create({
      data: { email: EMAIL, name: "Admin", passwordHash: hashPassword(PASSWORD), role: "OWNER" },
    })
    console.log("تم إنشاء المستخدم:", user.email)
  } else {
    console.log("المستخدم موجود — تحديث كلمة السر إلى السهلة")
    await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(PASSWORD) } })
  }

  const already = await db.workspaceMember.findFirst({
    where: { workspaceId: membership.workspaceId, userId: user.id },
  })
  if (!already) {
    await db.workspaceMember.create({
      data: { workspaceId: membership.workspaceId, userId: user.id, role: "OWNER" },
    })
    console.log("تم ربط الحساب بمساحة:", membership.workspaceId)
  } else {
    console.log("الربط موجود مسبقًا")
  }
  console.log("الدخول السهل جاهز — admin@leados.com / admin123")
}

main()
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.message.slice(0, 200) : e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
