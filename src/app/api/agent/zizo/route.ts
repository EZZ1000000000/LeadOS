// LeadOS — /api/agent/zizo : كيان البيع الذاتي (زيزو)
// GET   → حالة زيزو: محادثات/مراحل/لايف كولز/وقود الليدز + تفاصيل محادثة (?conversation=id)
// POST  → أفعال: reply | tick | outreach | open | config | close
import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { zizoReply, zizoTick, zizoOutreach, zizoStatus, openConversation, addClientMessage, pendingApprovals, approveDraft, rejectDraft } from "@/lib/agent/zizo/brain"
import { zizoConfigOf, AGENCY_SERVICES } from "@/lib/agent/zizo/services"

export const maxDuration = 60

interface ZizoBody {
  action?: string
  conversationId?: string
  leadId?: string
  channel?: string
  externalId?: string
  contactName?: string
  contactHandle?: string
  firstMessage?: string
  body?: string
  won?: boolean
  agencyName?: string
  liveCallHours?: string
  autoOutreach?: boolean
  requireApproval?: boolean
  autoFollowup?: boolean
  minOutreachScore?: number
  maxDailyOutreach?: number
  maxDailyMessages?: number
  minGapMinutes?: number
}

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const wsId = auth.workspace.id
  const convId = new URL(req.url).searchParams.get("conversation")
  if (convId) {
    const conv = await db.conversation.findFirst({
      where: { id: convId, workspaceId: wsId },
      include: {
        lead: { select: { id: true, score: true, status: true, business: { select: { name: true, city: true, phone: true, websiteUrl: true } } } },
        messages: { orderBy: { sentAt: "asc" }, take: 100 },
      },
    })
    if (!conv) return jsonError("محادثة غير موجودة", 404)
    return json({ conversation: conv })
  }
  const status = await zizoStatus(wsId)
  const pending = await pendingApprovals(wsId)
  const ws = await db.workspace.findUnique({ where: { id: wsId }, select: { settings: true } })
  return json({ ...status, pending, config: zizoConfigOf(ws?.settings), services: AGENCY_SERVICES.map((s) => ({ id: s.id, name: s.name, pitch: s.pitch })) })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const wsId = auth.workspace.id
  const body = (await readBody<ZizoBody>(req)) ?? {}
  const action = body?.action

  try {
    if (action === "reply") {
      const r = await zizoReply(wsId, String(body.conversationId ?? ""))
      return r.ok ? json(r) : jsonError(r.note, 400)
    }
    if (action === "tick") {
      const r = await zizoTick(wsId)
      return json(r)
    }
    if (action === "outreach") {
      const r = await zizoOutreach(wsId, String(body.leadId ?? ""))
      return r.ok ? json(r) : jsonError(r.note, 400)
    }
    if (action === "open") {
      const r = await openConversation(wsId, {
        leadId: body.leadId ? String(body.leadId) : undefined,
        channel: body.channel ? String(body.channel) : undefined,
        externalId: body.externalId ? String(body.externalId) : undefined,
        contactName: body.contactName ? String(body.contactName) : undefined,
        contactHandle: body.contactHandle ? String(body.contactHandle) : undefined,
        firstMessage: body.firstMessage ? String(body.firstMessage) : undefined,
      })
      if (r.needsReply) await zizoReply(wsId, r.id).catch(() => undefined)
      return json(r)
    }
    if (action === "client_msg") {
      const ok = await addClientMessage(wsId, String(body.conversationId ?? ""), String(body.body ?? ""))
      return ok ? json({ ok: true }) : jsonError("محادثة غير موجودة", 404)
    }
    if (action === "approve") {
      const r = await approveDraft(wsId, String(body.conversationId ?? ""))
      return r.ok ? json(r) : jsonError(r.note, 400)
    }
    if (action === "reject") {
      const r = await rejectDraft(wsId, String(body.conversationId ?? ""))
      return r.ok ? json(r) : jsonError(r.note, 400)
    }
    if (action === "close") {
      const won = Boolean(body.won)
      await db.conversation.update({
        where: { id: String(body.conversationId ?? "") },
        data: { status: won ? "WON" : "CLOSED", stage: won ? "CALL_BOOKED" : "LOST" },
      }).catch(() => undefined)
      return json({ ok: true })
    }
    if (action === "config") {
      const ws = await db.workspace.findUnique({ where: { id: wsId }, select: { settings: true } })
      const cur = (ws?.settings ?? {}) as Record<string, unknown>
      const z = (cur.zizo ?? {}) as Record<string, unknown>
      const next = {
        ...cur,
        zizo: {
          ...z,
          ...(body.agencyName !== undefined ? { agencyName: String(body.agencyName).slice(0, 80) } : {}),
          ...(body.liveCallHours !== undefined ? { liveCallHours: String(body.liveCallHours).slice(0, 80) } : {}),
          ...(body.autoOutreach !== undefined ? { autoOutreach: Boolean(body.autoOutreach) } : {}),
          ...(body.requireApproval !== undefined ? { requireApproval: Boolean(body.requireApproval) } : {}),
          ...(body.autoFollowup !== undefined ? { autoFollowup: Boolean(body.autoFollowup) } : {}),
          ...(body.maxDailyMessages !== undefined ? { maxDailyMessages: Math.max(1, Math.min(200, Number(body.maxDailyMessages) || 30)) } : {}),
          ...(body.minGapMinutes !== undefined ? { minGapMinutes: Math.max(1, Math.min(120, Number(body.minGapMinutes) || 6)) } : {}),
          ...(body.minOutreachScore !== undefined ? { minOutreachScore: Math.max(0, Math.min(100, Number(body.minOutreachScore) || 60)) } : {}),
          ...(body.maxDailyOutreach !== undefined ? { maxDailyOutreach: Math.max(0, Math.min(50, Number(body.maxDailyOutreach) || 12)) } : {}),
        },
      }
      await db.workspace.update({ where: { id: wsId }, data: { settings: next as never } })
      return json({ ok: true, config: zizoConfigOf(next) })
    }
    return jsonError("action غير معروف", 400)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "خطأ غير متوقع", 500)
  }
}
