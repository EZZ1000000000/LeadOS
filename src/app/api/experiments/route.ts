// LeadOS — تجارب A/B على رسايل التواصل API
import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const experiments = await db.abExperiment.findMany({
    where: { workspaceId: auth.workspace.id },
    orderBy: { createdAt: "desc" },
  })
  return json({ experiments })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = await readBody<{ name?: string; variants?: Array<{ name?: string; template?: string }>; notes?: string }>(req)
  if (!body?.name?.trim()) return jsonError("اسم التجربة مطلوب")
  const variants = (body.variants ?? [])
    .filter((v) => v.template?.trim())
    .map((v, i) => ({ name: v.name?.trim() || `صيغة ${i + 1}`, template: v.template!.trim(), sent: 0, replied: 0, won: 0 }))
  if (variants.length < 2) return jsonError("التجربة محتاجة صيغتين على الأقل بنص رسالة")
  const experiment = await db.abExperiment.create({
    data: {
      workspaceId: auth.workspace.id,
      name: body.name.trim(),
      notes: body.notes,
      variants: variants as never,
    },
  })
  return json({ experiment }, 201)
}
