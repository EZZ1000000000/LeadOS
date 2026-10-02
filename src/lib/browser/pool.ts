// LeadOS — Browser Pool لكل منصة (طلب §6 + §16 + §17 + §19 + §20)
// Pool مدفوع بقاعدة البيانات: كل متصفح حي = صف BrowserRuntime.
// الحالات: STARTING | READY | BUSY | IDLE | FAILED | RECOVERING | LOST | CLOSED
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { policyFor, type PlatformPolicy } from "./policy"

export const ACTIVE_RUNTIME_STATUSES = ["STARTING", "READY", "BUSY", "IDLE", "RECOVERING"]
export const HEARTBEAT_STALE_MS = 2 * 60_000 // 2 دقايق بلا heartbeat = Browser LOST
/** الميزانية العامة (طلب §20) — global capacity AND platform capacity كلهما يُحترم */
export const GLOBAL_BROWSER_LIMIT = Math.max(1, Number(process.env.LEADOS_GLOBAL_BROWSER_LIMIT) || 8)
export const GLOBAL_JOB_LIMIT = Math.max(1, Number(process.env.LEADOS_GLOBAL_JOB_LIMIT) || 24)

export type BrowserEventType =
  | "BROWSER_START" | "BROWSER_CLOSE" | "HEARTBEAT_LOST" | "RECOVER"
  | "SESSION_RESTORE" | "SESSION_SAVE" | "SESSION_HEALTH" | "CHECKPOINT"
  | "RATE_WAIT" | "POLICY_BLOCK" | "TASK_START" | "TASK_DONE" | "TASK_FAILED"
  | "DISPATCH" | "PLATFORM_PAUSED" | "STALE_RECOVER"

export async function recordEvent(
  workspaceId: string,
  type: BrowserEventType,
  opts?: {
    platform?: string; browserId?: string; generation?: number; ghRunId?: string | null
    detail?: Prisma.InputJsonValue
  },
): Promise<void> {
  try {
    await db.browserEvent.create({
      data: {
        workspaceId,
        type,
        platform: opts?.platform ?? "SYSTEM",
        browserId: opts?.browserId ?? null,
        generation: opts?.generation ?? 0,
        ghRunId: opts?.ghRunId ?? null,
        detail: (opts?.detail ?? {}) as Prisma.InputJsonValue,
      },
    })
  } catch { /* التسجيل best-effort — لا يكسر التشغيل */ }
}

export interface PoolCount { total: number; starting: number; ready: number; busy: number; idle: number; failed: number; recovering: number; lost: number; closed: number }

async function countByStatus(workspaceId: string, platform: string): Promise<PoolCount> {
  const rows = await db.browserRuntime.groupBy({
    by: ["status"],
    where: { workspaceId, platform },
    _count: { _all: true },
  })
  const c: PoolCount = { total: 0, starting: 0, ready: 0, busy: 0, idle: 0, failed: 0, recovering: 0, lost: 0, closed: 0 }
  for (const r of rows) {
    const n = r._count._all
    c.total += n
    if (r.status in c) (c as unknown as Record<string, number>)[r.status] = n
  }
  return c
}

/** عمق طابور منصة (جوبات BROWSER_SCAN المنتظرة لمنصة معينة) — تصفية JS متوافقة مع sqlite/postgres */
export async function platformQueueDepth(workspaceId: string, platform: string): Promise<number> {
  const rows = await db.job.findMany({
    where: { workspaceId, type: "BROWSER_SCAN", status: { in: ["QUEUED", "RETRYING"] } },
    select: { payload: true },
    take: 300,
  })
  return rows.filter((j) => (j.payload as { platform?: string } | null)?.platform === platform).length
}

export interface PlatformPool {
  platform: string
  count: PoolCount
  activeCapacity: number      // STARTING+READY+BUSY+IDLE+RECOVERING
  configuredLimit: number     // من السياسة
  freeSlots: number
  queueDepth: number
}

export async function platformPool(workspaceId: string, platform: string): Promise<PlatformPool> {
  const policy = policyFor(platform)
  const count = await countByStatus(workspaceId, platform)
  const activeCapacity = count.starting + count.ready + count.busy + count.idle + count.recovering
  const configuredLimit = policy?.maxConcurrentBrowsers ?? 0
  return {
    platform,
    count,
    activeCapacity,
    configuredLimit,
    freeSlots: Math.max(0, configuredLimit - activeCapacity),
    queueDepth: await platformQueueDepth(workspaceId, platform),
  }
}

export async function globalActiveBrowsers(workspaceId: string): Promise<number> {
  const agg = await db.browserRuntime.count({ where: { workspaceId, status: { in: ACTIVE_RUNTIME_STATUSES } } })
  return agg
}

/** كشف المتصفحات المفقودة: heartbeat قديم + الحالة لا تزال نشطة → LOST + إعادة جوباتها للطابور */
export async function reapLostBrowsers(workspaceId: string): Promise<{ lost: string[]; requeued: number }> {
  const cutoff = new Date(Date.now() - HEARTBEAT_STALE_MS)
  const stale = await db.browserRuntime.findMany({
    where: { workspaceId, status: { in: ACTIVE_RUNTIME_STATUSES }, lastHeartbeat: { lt: cutoff } },
    select: { id: true, browserId: true, platform: true, generation: true, currentTask: true },
  })
  const lost: string[] = []
  let requeued = 0
  for (const b of stale) {
    await db.browserRuntime.update({
      where: { id: b.id },
      data: { status: "LOST", lastError: "heartbeat متوقف — المتصفح فُقد", meta: { lostAt: new Date().toISOString(), lastTask: b.currentTask } as Prisma.InputJsonValue },
    })
    // checkpoint الحالة يبقى محفوظ — الجوبات ترجع للطابور ليتولاه متصفح آخر من نفس المنصة
    // (workerId في الادعاء = browser: + browserId — نفس مفتاح claimPlatformJobs/finishGeneration)
    const rq = await db.job.updateMany({
      where: { workerId: `browser:${b.browserId}`, status: "RUNNING" },
      data: { status: "QUEUED", lockedAt: null, workerId: null, scheduledAt: new Date() },
    })
    requeued += rq.count
    lost.push(b.browserId)
    await recordEvent(workspaceId, "HEARTBEAT_LOST", {
      platform: b.platform, browserId: b.browserId, generation: b.generation,
      detail: { requeued: rq.count, note: "Browser LOST → checkpoint محفوظ → جوبات رجعت للطابور" },
    })
  }
  // أيتام: جوبات RUNNING مالكها متصفح لم يعد نشطًا (LOST/CLOSED/FAILED/محو) — ترجع للطابور
  const orphans = await db.job.findMany({
    where: { type: "BROWSER_SCAN", status: "RUNNING", workerId: { startsWith: "browser:" } },
    select: { id: true, workerId: true },
  })
  for (const o of orphans) {
    const bid = (o.workerId ?? "").slice("browser:".length)
    if (!bid) continue
    const owner = await db.browserRuntime.findUnique({ where: { browserId: bid }, select: { status: true, platform: true, generation: true } })
    if (owner && ACTIVE_RUNTIME_STATUSES.includes(owner.status)) continue // مالكها حي — تُترك
    const rq = await db.job.updateMany({
      where: { id: o.id, status: "RUNNING" },
      data: { status: "QUEUED", lockedAt: null, workerId: null, scheduledAt: new Date() },
    })
    if (rq.count > 0) {
      requeued += rq.count
      await recordEvent(workspaceId, "STALE_RECOVER", {
        platform: owner?.platform ?? "SYSTEM", browserId: bid, generation: owner?.generation ?? 0,
        detail: { jobId: o.id, requeued: rq.count, note: "جوبة يتيمة (مالكها غير نشط) → رجعت الطابور" },
      })
    }
  }
  return { lost, requeued }
}

/** معرف بروفايل متصفح ثابت للمنصة (طلب §5 — Profile Affinity) */
export function profileIdFor(platform: string, slot: number): string {
  return `bpf-${platform.toLowerCase()}-${String(slot).padStart(2, "0")}`
}

/** معرف متصفح جديد */
export function newBrowserId(platform: string, generation: number): string {
  return `br-${platform.toLowerCase()}-g${generation}-${Math.random().toString(36).slice(2, 8)}`
}
