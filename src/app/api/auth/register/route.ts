import { db } from "@/lib/db"
import { createSession, hashPassword } from "@/lib/auth"
import { json, jsonError, readBody } from "@/lib/api-helpers"

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

export async function POST(req: Request) {
  const body = await readBody<{ name?: string; email?: string; password?: string; workspaceName?: string }>(req)
  if (!body?.email || !body?.password) return jsonError("البريد وكلمة المرور مطلوبان")
  if (body.password.length < 6) return jsonError("كلمة المرور يجب أن تكون 6 أحرف على الأقل")
  const email = body.email.trim().toLowerCase()
  const exists = await db.user.findUnique({ where: { email } })
  if (exists) return jsonError("البريد مستخدم بالفعل")

  const user = await db.user.create({
    data: {
      email,
      name: body.name?.trim() || email.split("@")[0],
      passwordHash: hashPassword(body.password),
      role: "OWNER",
    },
  })

  const wsName = body.workspaceName?.trim() || `مساحة ${user.name}`
  const slug = `${wsName.replace(/\s+/g, "-").slice(0, 20)}-${user.id.slice(-6)}`.toLowerCase()
  const workspace = await db.workspace.create({ data: { name: wsName, slug } })
  await db.workspaceMember.create({ data: { workspaceId: workspace.id, userId: user.id, role: "OWNER" } })
  await db.pipeline.create({
    data: {
      workspaceId: workspace.id,
      name: "خط المبيعات الرئيسي",
      isDefault: true,
      stages: { create: DEFAULT_STAGES },
    },
  })

  await createSession(user.id)
  return json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role }, workspaceId: workspace.id })
}
