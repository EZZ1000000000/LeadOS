// LeadOS — مراقبة Jina Reader (طلب §28 + §29)
// requestCount / successCount / failureCount / averageLatency / timeoutCount / lastSuccess
// Fire-and-forget: فشل القياس لا يكسر القراءة أبدًا — Jina fallback وليس نقطة فشل وحيدة.
import { db } from "@/lib/db"

export interface JinaCallMetric {
  ok: boolean
  latencyMs: number
  timeout?: boolean
  error?: string
}

export async function recordJinaMetric(m: JinaCallMetric): Promise<void> {
  try {
    const ws = await db.workspace.findFirst({ where: { isActive: true }, select: { id: true }, orderBy: { createdAt: "asc" } })
    if (!ws) return
    const day = new Date().toISOString().slice(0, 10)
    const existing = await db.jinaMetric.findUnique({ where: { workspaceId_day: { workspaceId: ws.id, day } } })
    if (existing) {
      await db.jinaMetric.update({
        where: { id: existing.id },
        data: {
          requestCount: { increment: 1 },
          successCount: { increment: m.ok ? 1 : 0 },
          failureCount: { increment: m.ok ? 0 : 1 },
          timeoutCount: { increment: m.timeout ? 1 : 0 },
          totalLatencyMs: { increment: Math.max(0, Math.round(m.latencyMs)) },
          lastSuccessAt: m.ok ? new Date() : existing.lastSuccessAt,
          lastError: m.ok ? null : (m.error ?? "فشل").slice(0, 300),
        },
      })
    } else {
      await db.jinaMetric.create({
        data: {
          workspaceId: ws.id, day,
          requestCount: 1,
          successCount: m.ok ? 1 : 0,
          failureCount: m.ok ? 0 : 1,
          timeoutCount: m.timeout ? 1 : 0,
          totalLatencyMs: Math.max(0, Math.round(m.latencyMs)),
          lastSuccessAt: m.ok ? new Date() : null,
          lastError: m.ok ? null : (m.error ?? "فشل").slice(0, 300),
        },
      })
    }
  } catch {
    /* القياس best-effort — لا يكسر المسار الرئيسي */
  }
}
