import { db } from "@/lib/db"
import { createSession, verifyPassword } from "@/lib/auth"
import { json, jsonError, readBody } from "@/lib/api-helpers"

export async function POST(req: Request) {
  const body = await readBody<{ email?: string; password?: string }>(req)
  if (!body?.email || !body?.password) return jsonError("البريد وكلمة المرور مطلوبان")
  const email = body.email.trim().toLowerCase()
  const user = await db.user.findUnique({ where: { email } })
  if (!user || !verifyPassword(body.password, user.passwordHash)) {
    return jsonError("بيانات الدخول غير صحيحة", 401)
  }
  if (!user.isActive) return jsonError("الحساب موقوف", 403)
  await createSession(user.id)
  return json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } })
}
