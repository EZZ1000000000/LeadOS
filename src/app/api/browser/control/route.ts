// LeadOS — Browser Control Center API (طلب §30 + §31 + §32 + §29)
// لوحة المتصفحات: Pools لكل منصة + سياساتها الحية + صحة الجلسات + Runtime Health + Jina + سلسلة generations.
// لا أسرار هنا: حالة الجلسة تُعرض كاسم حالة فقط — لا كوكيز ولا storage.
import { db } from "@/lib/db"
import { json, requireAuth, isResponse } from "@/lib/api-helpers"
import { allPolicies, type PlatformPolicy } from "@/lib/browser/policy"
import { platformPool, globalActiveBrowsers, GLOBAL_BROWSER_LIMIT, GLOBAL_JOB_LIMIT, reapLostBrowsers } from "@/lib/browser/pool"
import { loadSessionState } from "@/lib/browser/session-store"

export const maxDuration = 60
export const dynamic = "force-dynamic"

/** حالة GitHub Actions runtime (طلب §14) — قراءة حقيقية فقط: أي فشل جلب → UNKNOWN بلا تلفيق */
async function githubRuntimeStatus(): Promise<{
  state: "OPERATIONAL" | "FAILING" | "BLOCKED_EXTERNAL" | "UNKNOWN"
  lastRunAt: string | null
  conclusion: string | null
  url: string | null
  message?: string
}> {
  try {
    const repo = process.env.GH_ACTIONS_REPO || "EZZ1000000000/LeadOS"
    const workflow = process.env.GH_ACTIONS_WORKFLOW || "browser-runtime.yml"
    const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "leados-control" }
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/runs?per_page=1`, {
      headers, signal: AbortSignal.timeout(8000), cache: "no-store",
    })
    if (!res.ok) return { state: "UNKNOWN", lastRunAt: null, conclusion: null, url: null, message: `GitHub API HTTP ${res.status}` }
    const d = (await res.json()) as {
      workflow_runs?: Array<{ id: number; created_at: string; conclusion: string | null; status: string; html_url: string }>
    }
    const r = d.workflow_runs?.[0]
    if (!r) return { state: "UNKNOWN", lastRunAt: null, conclusion: null, url: null, message: "لا تشغيلات مسجلة" }
    const conclusion = r.conclusion ?? r.status
    // startup_failure على مستوى الحساب (فوترة/قيد خارجي) — أو الفشل المتكرر منذ الإقلاع
    const state = conclusion === "success" ? "OPERATIONAL" as const : conclusion === "startup_failure" ? "BLOCKED_EXTERNAL" as const : "FAILING" as const
    return { state, lastRunAt: r.created_at, conclusion, url: r.html_url }
  } catch (err) {
    return { state: "UNKNOWN", lastRunAt: null, conclusion: null, url: null, message: err instanceof Error ? err.message.slice(0, 120) : "فشل جلب حالة GitHub" }
  }
}

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const workspaceId = auth.workspace.id

  // حصاد المفقودين أولًا — اللوحة تعرض الواقع بعد الكشف لا قبله (§13)
  const reaped = await reapLostBrowsers(workspaceId).catch(() => ({ lost: [], requeued: 0 }))

  const platforms: Awaited<ReturnType<typeof buildPlatform>>[] = []
  async function buildPlatform(policy: PlatformPolicy) {
    const platform = policy.platform
    const [pool, session] = await Promise.all([
      platformPool(workspaceId, platform),
      loadSessionState(workspaceId, platform),
    ])
    // Actions داخل نافذة السياسة الحالية (TASK_DONE events)
    const windowStart = new Date(Date.now() - policy.windowMs)
    const [doneEvents, lastClose, lastBlock, lastDispatch] = await Promise.all([
      db.browserEvent.count({ where: { workspaceId, platform, type: "TASK_DONE", createdAt: { gte: windowStart } } }),
      db.browserEvent.findFirst({ where: { workspaceId, platform, type: "BROWSER_CLOSE" }, orderBy: { createdAt: "desc" }, select: { createdAt: true, detail: true } }),
      db.browserEvent.findFirst({ where: { workspaceId, platform, type: "POLICY_BLOCK" }, orderBy: { createdAt: "desc" }, select: { detail: true, createdAt: true } }),
      db.browserEvent.findFirst({ where: { workspaceId, platform, type: "DISPATCH" }, orderBy: { createdAt: "desc" }, select: { detail: true, createdAt: true } }),
    ])
    const cooldownUntil = lastClose ? new Date(lastClose.createdAt.getTime() + policy.cooldownAfterGenerationMs) : null
    const cooling = cooldownUntil ? cooldownUntil > new Date() : false
    // ممنوع تسريب أي قيمة جلسة — الحالة والأرقام فقط (§4 fields)
    return {
      platform,
      accessMode: policy.accessMode,
      notes: policy.notes,
      browsers: {
        count: pool.count.total,
        starting: pool.count.starting, ready: pool.count.ready, busy: pool.count.busy,
        idle: pool.count.idle, failed: pool.count.failed, recovering: pool.count.recovering,
        lost: pool.count.lost, closed: pool.count.closed,
        activeCapacity: pool.activeCapacity,
        configuredLimit: pool.configuredLimit,
        freeSlots: pool.freeSlots,
      },
      queue: pool.queueDepth,
      session: {
        status: session.status,
        version: session.sessionStateVersion,
        profileId: session.browserProfileId,
        lastValidatedAt: session.lastValidatedAt?.toISOString() ?? null,
        lastSuccessfulUse: session.lastSuccessfulUse?.toISOString() ?? null,
        seededFrom: session.seededFrom,
      },
      policyLive: {
        concurrencyInUse: pool.activeCapacity,
        concurrencyLimit: policy.maxConcurrentBrowsers,
        actionsInWindow: doneEvents,
        maxActionsPerWindow: policy.maxActionsPerWindow,
        remainingCapacity: Math.max(0, policy.maxActionsPerWindow - doneEvents),
        windowMs: policy.windowMs,
        cooldownActive: cooling,
        cooldownUntil: cooldownUntil?.toISOString() ?? null,
        activeHours: policy.activeHours,
      },
      lastBlock: lastBlock ? { reason: (lastBlock.detail as { reason?: string })?.reason ?? "BLOCK", at: lastBlock.createdAt.toISOString() } : null,
      lastDispatch: lastDispatch ? { at: lastDispatch.createdAt.toISOString(), detail: lastDispatch.detail } : null,
    }
  }

  for (const policy of allPolicies()) platforms.push(await buildPlatform(policy))

  // Runtime Health (§32)
  const dayAgo = new Date(Date.now() - 864e5)
  const [activeRuntimes, starts24h, closes24hRows, recoveries24h, restores24h, done24h, queuedOldest] = await Promise.all([
    db.browserRuntime.findMany({ where: { workspaceId, status: { in: ["STARTING", "READY", "BUSY", "IDLE", "RECOVERING"] } }, select: { startedAt: true, tasksCompleted: true } }),
    db.browserEvent.count({ where: { workspaceId, type: "BROWSER_START", createdAt: { gte: dayAgo } } }),
    db.browserEvent.findMany({ where: { workspaceId, type: "BROWSER_CLOSE", createdAt: { gte: dayAgo } }, select: { detail: true } }),
    db.browserEvent.count({ where: { workspaceId, type: "RECOVER", createdAt: { gte: dayAgo } } }),
    db.browserEvent.count({ where: { workspaceId, type: "SESSION_RESTORE", createdAt: { gte: dayAgo } } }),
    db.browserEvent.count({ where: { workspaceId, type: "TASK_DONE", createdAt: { gte: dayAgo } } }),
    db.job.findFirst({ where: { workspaceId, type: "BROWSER_SCAN", status: "QUEUED" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ])
  const crashes24h = closes24hRows.filter((e) => ["CRASH", "FATAL_ERROR", "SESSION_CORRUPTION"].includes((e.detail as { closeReason?: string } | null)?.closeReason ?? "")).length
  const browserRuntimeHealth = {
    activeBrowsers: activeRuntimes.length,
    globalActive: await globalActiveBrowsers(workspaceId),
    globalBrowserLimit: GLOBAL_BROWSER_LIMIT,
    globalJobLimit: GLOBAL_JOB_LIMIT,
    totalUptimeMinutes: Math.round(activeRuntimes.reduce((a, r) => a + (Date.now() - r.startedAt.getTime()), 0) / 60000),
    browserStarts24h: starts24h,
    unexpectedRestarts24h: crashes24h, // إعادة تشغيل غير ضرورية = crash/fatal فقط (إغلاق JOB_END طبيعي)
    sessionRecoveries24h: recoveries24h + restores24h,
    jobsPerBrowserRatio: activeRuntimes.length ? Number((done24h / Math.max(1, starts24h)).toFixed(2)) : 0,
    tasksDone24h: done24h,
    lostBrowsersReapedNow: reaped.lost.length,
    jobsRequeuedNow: reaped.requeued,
    queueWaitOldestMinutes: queuedOldest ? Math.round((Date.now() - queuedOldest.createdAt.getTime()) / 60000) : 0,
  }

  // سلسلة generations (آخر 10 dispatch) — N → N+1 بخط اليد
  const dispatches = await db.browserEvent.findMany({
    where: { workspaceId, type: "DISPATCH" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { platform: true, generation: true, createdAt: true, detail: true },
  })

  // Jina آخر 7 أيام (§29)
  const jinaRows = await db.jinaMetric.findMany({
    where: { workspaceId, day: { gte: new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10) } },
    orderBy: { day: "desc" },
  })
  const jina = jinaRows.map((j) => ({
    day: j.day,
    requests: j.requestCount,
    success: j.successCount,
    failure: j.failureCount,
    timeouts: j.timeoutCount,
    avgLatencyMs: j.successCount + j.failureCount > 0 ? Math.round(j.totalLatencyMs / (j.successCount + j.failureCount)) : 0,
    lastSuccessAt: j.lastSuccessAt?.toISOString() ?? null,
    lastError: j.lastError,
  }))

  // آخر الأحداث
  const events = await db.browserEvent.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { type: true, platform: true, browserId: true, generation: true, detail: true, createdAt: true },
  })

  return json({ platforms, health: browserRuntimeHealth, generations: dispatches, jina, events, github: await githubRuntimeStatus() })
}
