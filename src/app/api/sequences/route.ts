// LeadOS — سلاسل المتابعة API
import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { ensureDefaultSequences } from "@/lib/sequences"

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const created = await ensureDefaultSequences(auth.workspace.id)
  const sequences = await db.sequence.findMany({
    where: { workspaceId: auth.workspace.id },
    include: {
      steps: { orderBy: { order: "asc" } },
      enrollments: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "asc" },
  })
  return json({ sequences, seeded: created > 0, seededCount: created })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = await readBody<{
    name?: string
    description?: string
    kind?: string
    steps?: Array<{ template?: string; waitHours?: number; channel?: string }>
  }>(req)
  if (!body?.name?.trim()) return jsonError("اسم السلسلة مطلوب")
  const steps = (body.steps ?? []).filter((s) => s.template?.trim())
  if (!steps.length) return jsonError("خطوة واحدة على الأقل بنص رسالة مطلوبة")
  const sequence = await db.sequence.create({
    data: {
      workspaceId: auth.workspace.id,
      name: body.name.trim(),
      description: body.description,
      kind: (["NURTURE", "REACTIVATION", "ONBOARD"].includes(body.kind ?? "") ? body.kind : "NURTURE") as never,
      steps: {
        create: steps.map((s, i) => ({
          order: i + 1,
          template: s.template!.trim(),
          waitHours: Math.max(0, Number(s.waitHours ?? 72)),
          channel: (["TASK", "WHATSAPP", "EMAIL", "MANUAL"].includes(s.channel ?? "") ? s.channel : "TASK") as never,
        })),
      },
    },
    include: { steps: true },
  })
  return json({ sequence }, 201)
}
