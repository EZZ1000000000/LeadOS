import { db } from "@/lib/db"
import { json, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { aiChat, aiProviderStatus } from "@/lib/ai"
import { AI_TOOLS, executeTool, extractToolCall } from "@/lib/chat-tools"
import { LEAD_STATUS_LABELS } from "@/lib/constants"

interface LeadLikeRow {
  id?: string
  company?: string | null
  city?: string | null
  industry?: string | null
  score?: number
  temperature?: string
  stage?: string
}

/** Deterministic Arabic summary when the model fails to produce a natural answer. */
function formatFallbackAnswer(
  toolCalls: Array<{ tool: string; summary: string; ok: boolean }>,
  data: unknown,
): string {
  const lines: string[] = []
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object" && data[0] !== null && "score" in (data[0] as object)) {
    lines.push("دي النتائج اللي طلعتها:")
    for (const item of data.slice(0, 10) as LeadLikeRow[]) {
      lines.push(`• ${item.company ?? "—"} — Score ${item.score ?? 0}${item.stage ? ` — ${item.stage}` : ""}${item.city ? ` — ${item.city}` : ""}`)
    }
  } else {
    for (const t of toolCalls) {
      lines.push(`${t.ok ? "✓" : "✗"} ${t.summary}`)
    }
  }
  if (!lines.length) lines.push("تم تنفيذ طلبك.")
  return lines.join("\n")
}

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const sessions = await db.aiChatSession.findMany({
    where: { workspaceId: auth.workspace.id },
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: { _count: { select: { messages: true } } },
  })
  return json({ sessions, ai: aiProviderStatus(), tools: AI_TOOLS.map((t) => t.name) })
}

const SYSTEM_PROMPT = (wsName: string) => `أنت "AI Commander" — واجهة القيادة الذكية لمنصة LeadOS (${wsName}) لإدارة وتوليد العملاء المحتملين.
مهمتك: فهم أوامر المستخدم بالعربي أو الإنجليزي وتنفيذها عبر الأدوات المتاحة، ثم الرد بملخص واضح ومختصر بالعربية.

الأدوات المتاحة:
${AI_TOOLS.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

قواعد صارمة:
1. إذا طلب المستخدم بحثًا أو عرضًا أو تعديلًا أو إجراءً على البيانات → أصدر أمر أداة فقط بهذا الشكل في سطر مستقل:
{"tool":"اسم_الأداة","arguments":{...}}
2. بعد تنفيذ الأداة ستعود إليك النتائج، فاستخدمها في الرد النهائي (لا تخترع بيانات).
3. المراحل المعتمدة في الـCRM: ${Object.keys(LEAD_STATUS_LABELS).filter((k) => k !== "ARCHIVED").join(", ")} (بالإنجليزية داخل الأوامر).
4. إن كان الرد استشاريًا فقط (بدون بيانات) فأجب مباشرة بدون أداة.
5. لا تنفذ أي شيء خارج أدواتك. لا SQL. لا افتراضات عن بيانات غير موجودة.`

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const wsId = auth.workspace.id
  const body = await readBody<{ message?: string; sessionId?: string }>(req)
  if (!body?.message?.trim()) return json({ error: "الرسالة مطلوبة" }, 400)

  // Session
  let session = body.sessionId
    ? await db.aiChatSession.findFirst({ where: { id: body.sessionId, workspaceId: wsId } })
    : null
  if (!session) {
    session = await db.aiChatSession.create({
      data: { workspaceId: wsId, userId: auth.user.id, title: body.message.slice(0, 60) },
    })
  }

  await db.aiChatMessage.create({ data: { sessionId: session.id, role: "user", content: body.message.trim() } })

  // History
  const history = await db.aiChatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
    take: 12,
  })

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT(auth.workspace.name) },
    ...history.slice(-10).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ]

  const toolCallsExecuted: Array<{ tool: string; summary: string; ok: boolean }> = []
  let finalText = ""
  let lastToolData: unknown = null
  for (let round = 0; round < 3; round++) {
    const result = await aiChat(messages, { workspaceId: wsId, runType: "CHAT", temperature: 0.3, maxTokens: 900, task: "chat" })
    if (!result) {
      finalText = round === 0
        ? "معلش، محرك الذكاء الاصطناعي مش متاح حاليًا. جرّب تاني بعد شوية أو استخدم الفلاتر اليدوية من شاشة الـLeads."
        : finalText || "تعذّر إكمال الطلب."
      break
    }
    const toolCall = extractToolCall(result.text)
    if (!toolCall) {
      finalText = result.text.trim()
      break
    }
    const toolResult = await executeTool(wsId, toolCall.tool, toolCall.arguments ?? {})
    lastToolData = toolResult.data ?? null
    toolCallsExecuted.push({ tool: toolCall.tool, summary: toolResult.summary, ok: toolResult.ok })
    messages.push({ role: "assistant", content: result.text })
    messages.push({
      role: "user",
      content: `نتيجة تنفيذ الأداة ${toolCall.tool}:\n${JSON.stringify(toolResult.data ?? toolResult.summary).slice(0, 2500)}\n\nمهم: اكتب الآن الرد النهائي للمستخدم بالعربي الطبيعي (جمل وليس JSON) ملخصًا هذه النتائج. لا تعيد أمر أداة.`,
    })
  }
  // Safety net: if the model kept emitting tool-call JSON, format results ourselves
  if (!finalText || extractToolCall(finalText)) {
    finalText = formatFallbackAnswer(toolCallsExecuted, lastToolData)
  }

  const saved = await db.aiChatMessage.create({
    data: {
      sessionId: session.id,
      role: "assistant",
      content: finalText || "تم.",
      toolCalls: (toolCallsExecuted.length ? toolCallsExecuted : undefined) as never,
    },
  })
  await db.aiChatSession.update({ where: { id: session.id }, data: { updatedAt: new Date() } })
  return json({ sessionId: session.id, message: saved, toolCalls: toolCallsExecuted })
}
