// LeadOS — POST /api/agent/run : تشغيل الأيجنت الداخلي على هدف واحد (ذاكرة → صيد → تعلم)
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { runAgent } from "@/lib/agent/loop"

export const maxDuration = 120

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = await readBody<{ objective?: string; platforms?: string[]; forceFresh?: boolean; exportCsv?: boolean }>(req)
  const objective = (body?.objective ?? "").trim()
  if (objective.length < 5) return jsonError("اكتب هدفًا واضحًا للأيجنت (5 أحرف على الأقل)", 400)
  if (objective.length > 300) return jsonError("الهدف طويل جدًا (الحد 300 حرف)", 400)

  const result = await runAgent(auth.workspace.id, objective, {
    platforms: body?.platforms?.map(String),
    forceFresh: Boolean(body?.forceFresh),
    exportCsv: Boolean(body?.exportCsv),
  })
  return json(result)
}
