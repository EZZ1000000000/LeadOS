// LeadOS — Browser Generation API (بروتوكول الـrunner — طلب §22 + §23)
// الـrunner داخل GitHub Actions يتكلم هنا: start → heartbeat → checkpoint → task → finish.
// المصادقة: نفس قناة النبضة (x-cron-secret / Bearer / ?secret=) أو جلسة مسجلة.
// لا قيم كوكيز ولا storage تعود للواجهة — الجلسة تسير للـrunner عبر قناة مشفرة فقط.
import { db } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"
import { json, jsonError, readBody } from "@/lib/api-helpers"
import {
  startGeneration, heartbeatGeneration, checkpointGeneration, completeTask, finishGeneration,
} from "@/lib/browser/generation"

export const maxDuration = 60

async function authorized(req: Request): Promise<boolean> {
  const url = new URL(req.url)
  const secret = process.env.CRON_SECRET
  const altSecret = process.env.CRON_SECRET_ALT
  const authHeader = req.headers.get("authorization") ?? ""
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null
  const provided = req.headers.get("x-cron-secret") ?? bearer ?? url.searchParams.get("secret")
  if ((secret && provided === secret) || (altSecret && provided === altSecret)) return true
  return Boolean(await getSessionUser())
}

export async function POST(req: Request) {
  if (!(await authorized(req))) return jsonError("غير مصرح", 401)
  const body = await readBody<{
    action?: string
    platform?: string
    runnerId?: string
    ghRunId?: string
    browserId?: string
    currentTask?: string
    rateWait?: { waitedMs?: number; windowActions?: number }
    jobId?: string
    step?: string
    cursor?: unknown
    ok?: boolean
    note?: string
    data?: Record<string, unknown>
    closeReason?: "JOB_END" | "CRASH" | "SESSION_CORRUPTION" | "FATAL_ERROR" | "PLATFORM_RESET"
    storageState?: string | null
    sessionHealth?: "READY" | "HEALTHY" | "DEGRADED" | "EXPIRED" | "NEEDS_SESSION" | "FAILED" | "RECOVERING"
    cookieCount?: number
  }>(req)
  const action = body?.action ?? ""

  try {
    switch (action) {
      case "start": {
        const r = await startGeneration({
          platform: body?.platform,
          runnerId: body?.runnerId,
          ghRunId: body?.ghRunId,
        })
        return json(r, 200)
      }
      case "heartbeat": {
        if (!body?.browserId) return jsonError("browserId مطلوب", 400)
        const r = await heartbeatGeneration(body.browserId, body.currentTask, body.rateWait ?? undefined)
        return json(r, r.ok ? 200 : 404)
      }
      case "checkpoint": {
        if (!body?.browserId || !body?.jobId || !body?.step) return jsonError("browserId/jobId/step مطلوبة", 400)
        const r = await checkpointGeneration(body.browserId, body.jobId, body.step, body.cursor)
        return json(r, r.ok ? 200 : 404)
      }
      case "task": {
        if (!body?.browserId || !body?.jobId) return jsonError("browserId/jobId مطلوبة", 400)
        const r = await completeTask(body.browserId, body.jobId, {
          ok: Boolean(body?.ok),
          note: body?.note,
          data: body?.data as never,
        })
        return json(r, 200)
      }
      case "finish": {
        if (!body?.browserId) return jsonError("browserId مطلوب", 400)
        const r = await finishGeneration(body.browserId, {
          closeReason: body?.closeReason,
          storageState: body?.storageState ?? null,
          sessionHealth: body?.sessionHealth,
          cookieCount: body?.cookieCount,
          note: body?.note,
        })
        return json(r, r.ok ? 200 : 404)
      }
      default:
        return jsonError("action غير معروفة — المتاح: start/heartbeat/checkpoint/task/finish", 400)
    }
  } catch (err) {
    return jsonError(`خطأ browser generation: ${err instanceof Error ? err.message.slice(0, 200) : "غير معروف"}`, 500)
  }
}

/** GET: المتصفحات الحية — فحص سريع للمراقبة */
export async function GET() {
  const auth = await getSessionUser()
  if (!auth) return jsonError("غير مصرح", 401)
  const actives = await db.browserRuntime.findMany({
    where: { status: { in: ["STARTING", "READY", "BUSY", "IDLE", "RECOVERING"] } },
    orderBy: { startedAt: "desc" },
    take: 50,
    select: {
      platform: true, browserId: true, profileId: true, generation: true, status: true,
      currentTask: true, tasksCompleted: true, startedAt: true, lastHeartbeat: true, ghRunId: true,
    },
  })
  return json({ browsers: actives })
}
