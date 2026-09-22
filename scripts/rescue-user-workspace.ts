// LeadOS — إنقاذ المستخدم والمساحة بعد الـreset (idempotent)
// نفس منطق /api/auth/register بالظبط لكن مباشرة على القاعدة
import { PrismaClient } from "@prisma/client"
import { hashPassword } from "../src/lib/auth"

const db = new PrismaClient()

const DEFAULT_STAGES = [
  { name: "جديد", position: 0, color: "#6b7280", probability: 10 },
  { name: "مؤهل", position: 1, color: "#0ea5e9", probability: 25 },
  { name: "تم التواصل", position: 2, color: "#8b5cf6", probability: 40 },
  { name: "رد عليك", position: 3, color: "#a855f7", probability: 50 },
  { name: "مهتم", position: 4, color: "#ec4899", probability: 60 },
  { name: "اجتماع", position: 5, color: "#f97316", probability: 70 },
  { name: "عرض سعر", position: 6, color: "#eab308", probability: 80 },
  { name: "تم الإغلاق", position: 7, color: "#22c55e", probability: 100 },
  { name: "خسارة", position: 8, color: "#ef4444", probability: 0 },
  { name: "تنمية علاقة", position: 9, color: "#14b8a6", probability: 30 },
]

const EMAIL = "samgany278@gmail.com"
const TEMP_PASSWORD = process.env.RESCUE_PASSWORD || "Zizo@2026"

async function main() {
  let user = await db.user.findUnique({ where: { email: EMAIL } })
  if (!user) {
    user = await db.user.create({
      data: {
        email: EMAIL,
        name: "Sam",
        passwordHash: hashPassword(TEMP_PASSWORD),
        role: "OWNER",
      },
    })
    console.log(`✅ المستخدم اتعمل: ${user.email} (باسورد مؤقت: ${TEMP_PASSWORD})`)
  } else {
    console.log(`✓ المستخدم موجود بالفعل: ${user.email}`)
  }

  let membership = await db.workspaceMember.findFirst({ where: { userId: user.id } })
  let workspace = membership
    ? await db.workspace.findUnique({ where: { id: membership.workspaceId } })
    : null

  if (!workspace) {
    const wsName = "LeadOS"
    const slug = `${wsName.toLowerCase()}-${user.id.slice(-6)}`
    workspace = await db.workspace.create({ data: { name: wsName, slug } })
    await db.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: user.id, role: "OWNER" },
    })
    console.log(`✅ المساحة اتعملت: ${workspace.name} (${workspace.id})`)
  } else {
    console.log(`✓ المساحة موجودة: ${workspace.name} (${workspace.id})`)
  }

  const pipeline = await db.pipeline.findFirst({ where: { workspaceId: workspace.id } })
  if (!pipeline) {
    await db.pipeline.create({
      data: { workspaceId: workspace.id, name: "خط المبيعات الرئيسي", isDefault: true, stages: { create: DEFAULT_STAGES } },
    })
    console.log("✅ البايبلاين الافتراضي اتعمل بمراحله العشرة")
  } else {
    console.log("✓ البايبلاين موجود")
  }

  console.log("\n✅ الإنقاذ الأساسي خلص — جاهز لبذور المصادر والمعرفة")
  await db.$disconnect()
}

main().catch((e) => { console.error("فشل:", e); process.exit(1) })
