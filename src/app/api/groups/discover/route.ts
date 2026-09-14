import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { discoverGroups } from "@/lib/monitors/scan"
import type { Segment } from "@/lib/monitors/segments"

/** POST /api/groups/discover — اكتشاف جروبات جديدة بالكلمات المفتاحية (بحث حي) */
export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = await readBody<{ platform?: string; keywords?: string[] | string; segment?: string }>(req)
  const platform = body?.platform ?? "FACEBOOK"
  if (!["FACEBOOK", "TELEGRAM", "REDDIT", "X"].includes(platform)) return jsonError("منصة غير مدعومة")

  const rawKeywords = Array.isArray(body?.keywords) ? body.keywords : (body?.keywords ?? "").split("\n")
  const keywords = rawKeywords.map((k) => k.trim()).filter(Boolean)
  if (!keywords.length) return jsonError("اكتب كلمة مفتاحية واحدة على الأقل")

  const segment: Segment = body?.segment === "CARDS" || body?.segment === "AGENCY" || body?.segment === "BOTH" ? body.segment : "BOTH"
  const result = await discoverGroups({ workspaceId: auth.workspace.id, platform, keywords, segment })
  return json(result)
}
