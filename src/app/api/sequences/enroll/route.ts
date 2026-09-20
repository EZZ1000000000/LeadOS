// LeadOS — تجنيد ليد في سلسلة متابعة
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { enrollLead } from "@/lib/sequences"

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = await readBody<{ leadId?: string; sequenceId?: string }>(req)
  if (!body?.leadId) return jsonError("leadId مطلوب")
  const result = await enrollLead(auth.workspace.id, body.leadId, body.sequenceId)
  return json(result, result.ok ? 200 : 400)
}
