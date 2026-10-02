// LeadOS — Generation Engine (طلب §1 + §2 + §13 + §14 + §16..§23)
// START → BROWSER SESSION LOAD → LONG-LIVED PLATFORM RUNTIME → MANY TASKS →
// CHECKPOINT → FINISH JOB → NEXT GENERATION → RESTORE SESSION → CONTINUE
// قاعدة القاعدة: متصفح واحد = منصة واحدة طوال عمر الـJob. لا إغلاق بين المهام.
import type { Prisma } from "@prisma/client"
import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { policyFor, type PlatformPolicy, type BrowserTaskType } from "./policy"
import { profileIdFor, newBrowserId, recordEvent, reapLostBrowsers, GLOBAL_BROWSER_LIMIT } from "./pool"
import { complianceGuard, taskSessionOk } from "./compliance"
import { loadSessionState, saveSessionState, recordSessionHealth, markSessionUsed } from "./session-store"

const WORKER_PREFIX = "browser:"

export interface GenerationJob {
  id: string
  task: string
  payload: Record<string, unknown>
  checkpoint: { step: string; cursor: Prisma.JsonValue | null } | null
}

export type GenerationStart =
  | {
      ok: true; decision: "ALLOW"
      platform: string; generation: number
      browserId: string; profileId: string; runnerId: string | null
      policy: PlatformPolicy
      jobs: GenerationJob[]
      session: { status: string; version: number; storage: string | null; profileId: string }
      note?: string
    }
  | { ok: false; decision: "QUEUE" | "BLOCK" | "IDLE"; reason?: string; note: string; platform?: string }

async function workspaceIdOf(): Promise<string | null> {
  const ws = await db.workspace.findFirst({ where: { isActive: true }, select: { id: true }, orderBy: { createdAt: "asc" } })
  return ws?.id ?? null
}

/** أول slot حر حسب البروفايلات النشطة — Affinity: كل منصة لها أرقام بروفايلها الخاصة فقط */
async function freeSlot(workspaceId: string, platform: string, limit: number): Promise<number | null> {
  if (limit <= 0) return null
  const active = await db.browserRuntime.findMany({
    where: { workspaceId, platform, status: { in: ["STARTING", "READY", "BUSY", "IDLE", "RECOVERING"] } },
    select: { profileId: true },
  })
  const taken = new Set(active.map((a) => a.profileId))
  for (let i = 1; i <= limit; i++) {
    const pid = profileIdFor(platform, i)
    if (!taken.has(pid)) return i
  }
  return null
}

/** منصات عليها طابور BROWSER_SCAN — مرتبة بالأعمق أولًا */
async function platformsWithWork(workspaceId: string): Promise<Array<{ platform: string; depth: number }>> {
  const jobs = await db.job.findMany({
    where: { workspaceId, type: "BROWSER_SCAN", status: { in: ["QUEUED", "RETRYING"] }, scheduledAt: { lte: new Date() } },
    select: { payload: true },
    take: 200,
  })
  const depth = new Map<string, number>()
  for (const j of jobs) {
    const p = (j.payload as { platform?: string } | null)?.platform
    if (p) depth.set(p, (depth.get(p) ?? 0) + 1)
  }
  return [...depth.entries()].map(([platform, d]) => ({ platform, depth: d })).sort((a, b) => b.depth - a.depth)
}

/** claim ذرّي لجوبات منصة واحدة فقط — لا جوب منصة أخرى يمسها هذا المتصفح أبدًا (§16) */
async function claimPlatformJobs(workspaceId: string, platform: string, browserId: string, limit: number): Promise<GenerationJob[]> {
  const candidates = await db.job.findMany({
    where: {
      workspaceId, type: "BROWSER_SCAN",
      status: { in: ["QUEUED", "RETRYING"] }, scheduledAt: { lte: new Date() },
    },
    orderBy: [{ priority: "desc" }, { scheduledAt: "asc" }],
    take: limit * 5 + 20, // هامش للتصفية اليدوية للمنصة
  })
  const claimed: GenerationJob[] = []
  for (const job of candidates) {
    if (claimed.length >= limit) break
    const payload = (job.payload ?? {}) as Record<string, unknown>
    if (payload.platform !== platform) continue // حرس affinity — لا جوب منصة أخرى يمسها هذا المتصفح أبدًا (§16)
    const upd = await db.job.updateMany({
      where: { id: job.id, status: { in: ["QUEUED", "RETRYING"] } },
      data: { status: "RUNNING", startedAt: new Date(), lockedAt: new Date(), workerId: WORKER_PREFIX + browserId, attempts: { increment: 1 } },
    })
    if (upd.count === 0) continue // claimed by another browser — atomicity
    // checkpoint سابق نشط لهذه الجوبة؟ (استكمال لا إعادة من الصفر — §14)
    const cp = await db.browserCheckpoint.findFirst({
      where: { jobId: job.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    })
    if (cp) {
      await db.browserCheckpoint.update({ where: { id: cp.id }, data: { status: "RESTORED", restoredAt: new Date() } })
      await recordEvent(workspaceId, "CHECKPOINT", { platform, browserId, generation: 0, detail: { restored: true, jobId: job.id, step: cp.step } })
    }
    claimed.push({
      id: job.id,
      task: String(payload.task ?? "PUBLIC_FETCH"),
      payload,
      checkpoint: cp ? { step: cp.step, cursor: cp.cursor } : null,
    })
  }
  return claimed
}

/**
 * بدء جيل جديد: درع الامتثال → slot حر → فتح متصفح (صف) → استعادة الجلسة → claim جوبات المنصة.
 * يُنفَّذ داخل الـrunner في بداية كل GitHub Actions Job.
 */
export async function startGeneration(opts: { platform?: string; runnerId?: string; ghRunId?: string }): Promise<GenerationStart> {
  const workspaceId = await workspaceIdOf()
  if (!workspaceId) return { ok: false, decision: "IDLE", note: "لا توجد ورشة نشطة" }

  // 0) حصاد المتصفحات المفقودة أولًا (heartbeat stale → LOST → requeue) — §13
  await reapLostBrowsers(workspaceId)

  // 1) اختيار المنصة: المعطاة، أو أعمق طابور يمر من درع الامتثال
  const candidates = opts.platform ? [opts.platform.toUpperCase()] : (await platformsWithWork(workspaceId)).map((c) => c.platform)
  if (!candidates.length) return { ok: false, decision: "IDLE", note: "لا طابور متصفح مستحق الآن — لا جيل جديد قبل الحاجة الفعلية (§23)" }

  let chosen: { platform: string; guard: Awaited<ReturnType<typeof complianceGuard>> } | null = null
  for (const platform of candidates) {
    const guard = await complianceGuard(workspaceId, platform)
    if (guard.decision === "ALLOW") { chosen = { platform, guard }; break }
    if (!chosen || guard.decision === "QUEUE") chosen = { platform, guard } // نحتفظ بأول سبب مؤقت للتقرير
  }
  if (!chosen) return { ok: false, decision: "IDLE", note: "لا منصات مستحقة" }
  const { platform, guard } = chosen
  if (guard.decision !== "ALLOW") {
    await recordEvent(workspaceId, "POLICY_BLOCK", { platform, ghRunId: opts.ghRunId, detail: { reason: guard.reason, note: guard.note } })
    return { ok: false, decision: guard.decision, reason: guard.reason, note: guard.note ?? "غير مسموح الآن", platform }
  }
  const policy = guard.policy as PlatformPolicy

  // 2) slot حر داخل سعة المنصة (Affinity)
  const slot = await freeSlot(workspaceId, platform, policy.maxConcurrentBrowsers)
  if (slot === null) {
    await recordEvent(workspaceId, "POLICY_BLOCK", { platform, ghRunId: opts.ghRunId, detail: { reason: "CAPACITY_LIMIT", note: "لا slot حر" } })
    return { ok: false, decision: "QUEUE", reason: "CAPACITY_LIMIT", note: "سعة المنصة ممتلئة — الانتظار", platform }
  }

  // 3) رقم الجيل: آخر جيل مغلق للمنصة + 1
  const lastGen = await db.browserRuntime.findFirst({
    where: { workspaceId, platform, status: { in: ["CLOSED", "LOST", "FAILED"] } },
    orderBy: { generation: "desc" },
    select: { generation: true },
  })
  const generation = (lastGen?.generation ?? 0) + 1

  // 4) فتح المتصفح (صف runtime) — ONE PLATFORM → ONE DEDICATED BROWSER RUNTIME
  const browserId = newBrowserId(platform, generation)
  const profileId = profileIdFor(platform, slot)
  const runtime = await db.browserRuntime.create({
    data: {
      workspaceId, platform, browserId, profileId, generation,
      runnerId: opts.runnerId ?? null, ghRunId: opts.ghRunId ?? null,
      status: "READY",
      meta: { slot, globalLimit: GLOBAL_BROWSER_LIMIT } as Prisma.InputJsonValue,
    },
  })
  await recordEvent(workspaceId, "BROWSER_START", { platform, browserId, generation, ghRunId: opts.ghRunId, detail: { profileId, runnerId: opts.runnerId ?? null, note: "متصفح مخصص للمنصة — يعيش طول الـJob" } })

  // 5) استعادة حالة الجلسة (Persistent Session State — لا جلسة جديدة بلا سبب)
  const session = await loadSessionState(workspaceId, platform)
  if (session.storage) {
    await recordEvent(workspaceId, "SESSION_RESTORE", { platform, browserId, generation, ghRunId: opts.ghRunId, detail: { version: session.sessionStateVersion, status: session.status, seededFrom: session.seededFrom } })
  }

  // 6) claim جوبات المنصة فقط
  const jobs = await claimPlatformJobs(workspaceId, platform, browserId, policy.maxJobsPerGeneration)
  if (!jobs.length) {
    // لا شغل فعلي → إغلاق نظيف بدون جيل فارغ
    await db.browserRuntime.update({ where: { id: runtime.id }, data: { status: "CLOSED", closedAt: new Date(), closeReason: "JOB_END", lastError: "لا جوبات بعد فتح المتصفح" } })
    await recordEvent(workspaceId, "BROWSER_CLOSE", { platform, browserId, generation, detail: { closeReason: "JOB_END", note: "IDLE — لا جوبات" } })
    return { ok: false, decision: "IDLE", note: "لا جوبات مستحقة للمنصة الآن", platform }
  }

  return {
    ok: true, decision: "ALLOW",
    platform, generation, browserId, profileId, runnerId: opts.runnerId ?? null,
    policy, jobs,
    session: { status: session.status, version: session.sessionStateVersion, storage: session.storage, profileId: session.browserProfileId },
    note: `متصفح مخصص ${profileId} — ${jobs.length} مهمة على ${platform} بدون أي إغلاق بينها`,
  }
}

/** heartbeat — كل متصفح ينبض؛ توقف النبض = LOST عبر reapLostBrowsers (§13) */
export async function heartbeatGeneration(browserId: string, currentTask?: string, rateWait?: { waitedMs?: number; windowActions?: number }): Promise<{ ok: boolean }> {
  const rt = await db.browserRuntime.findUnique({ where: { browserId } })
  if (!rt) return { ok: false }
  await db.browserRuntime.update({
    where: { id: rt.id },
    data: { lastHeartbeat: new Date(), status: "BUSY", ...(currentTask !== undefined ? { currentTask: currentTask.slice(0, 300) } : {}) },
  })
  if (rateWait) {
    await recordEvent(rt.workspaceId, "RATE_WAIT", {
      platform: rt.platform, browserId, generation: rt.generation,
      detail: { waitedMs: rateWait.waitedMs, windowActions: rateWait.windowActions, note: "وصل للحد → WAIT ثم RESUME (§9)" },
    })
  }
  return { ok: true }
}

/** checkpoint قبل أي عملية طويلة (§14) */
export async function checkpointGeneration(browserId: string, jobId: string, step: string, cursor: unknown): Promise<{ ok: boolean }> {
  const rt = await db.browserRuntime.findUnique({ where: { browserId } })
  if (!rt) return { ok: false }
  await db.browserCheckpoint.create({
    data: {
      workspaceId: rt.workspaceId, browserId, platform: rt.platform,
      jobId, ghRunId: rt.ghRunId, generation: rt.generation,
      step: step.slice(0, 120),
      cursor: (cursor ?? {}) as Prisma.InputJsonValue,
    },
  })
  await db.browserRuntime.update({ where: { id: rt.id }, data: { checkpointAt: new Date() } })
  await recordEvent(rt.workspaceId, "CHECKPOINT", { platform: rt.platform, browserId, generation: rt.generation, ghRunId: rt.ghRunId, detail: { jobId, step } })
  return { ok: true }
}

export interface TaskCompletion {
  ok: boolean
  note?: string
  data?: {
    posts?: Array<{ externalId?: string; url?: string; author?: string; content: string; postedAt?: string }>
    membersText?: string
    status?: "OK" | "NEEDS_SESSION" | "BLOCKED" | "ERROR"
    text?: string
    via?: string
    sessionHealth?: "READY" | "HEALTHY" | "DEGRADED" | "EXPIRED" | "NEEDS_SESSION" | "FAILED" | "RECOVERING"
    [key: string]: unknown
  }
}

/** اكتمال مهمة داخل المتصفح الحي — النتائج تُدخل في نفس خط المعالجة الحقيقي (تصنيف→تقييم→CRM) */
export async function completeTask(browserId: string, jobId: string, completion: TaskCompletion): Promise<{ ok: boolean; summary: string }> {
  const rt = await db.browserRuntime.findUnique({ where: { browserId } })
  if (!rt) return { ok: false, summary: "browser غير معروف" }
  const job = await db.job.findUnique({ where: { id: jobId } })
  if (!job) return { ok: false, summary: "job غير معروف" }
  const policy = policyFor(rt.platform)

  if (completion.ok) {
    let summary = "تمت المهمة"
    const data = completion.data ?? {}
    try {
      if (String((job.payload as { task?: string }).task) === "GROUPS_SCAN" && Array.isArray(data.posts)) {
        const { ingestBrowserRawPosts } = await import("@/lib/monitors/scan")
        const group = {
          id: String((job.payload as { groupId?: string }).groupId ?? ""),
          workspaceId: rt.workspaceId, platform: rt.platform,
          name: String((job.payload as { groupName?: string }).groupName ?? ""),
          externalId: String((job.payload as { groupExternalId?: string }).groupExternalId ?? ""),
          url: String((job.payload as { groupUrl?: string }).groupUrl ?? ""),
        }
        const n = await ingestBrowserRawPosts(
          group, data.posts as never,
          String(data.status ?? "OK") as "OK" | "NEEDS_SESSION" | "BLOCKED" | "ERROR",
          data.note !== undefined ? String(data.note) : undefined,
          data.membersText !== undefined ? String(data.membersText) : undefined,
        )
        summary = `GROUPS_SCAN: منشورات جديدة=${n}`
      } else if (String((job.payload as { task?: string }).task) === "RADAR_SCAN" && Array.isArray(data.posts)) {
        const { ingestRadarRawPosts } = await import("@/lib/radar")
        const r = await ingestRadarRawPosts(rt.workspaceId, {
          id: String((job.payload as { groupId?: string }).groupId ?? ""),
          name: String((job.payload as { groupName?: string }).groupName ?? ""),
          url: String((job.payload as { groupUrl?: string }).groupUrl ?? ""),
        }, data.posts as never)
        summary = `RADAR_SCAN: فُحص=${r.considered} مؤهل=${r.qualified} منشورات=${r.created} ليدز=${r.leads} تعليقات=${r.commentsScheduled}`
      } else if (String((job.payload as { task?: string }).task) === "PUBLIC_FETCH" && typeof data.text === "string") {
        const { ingestDiscoveredItems } = await import("@/lib/queue")
        const src = await db.source.findFirst({ where: { workspaceId: rt.workspaceId, status: "ACTIVE" }, select: { id: true, type: true, name: true } })
        if (src) {
          const url = String((job.payload as { url?: string }).url ?? data.via ?? "https://unknown")
          const text = data.text
          const r = await ingestDiscoveredItems(rt.workspaceId, src, null, [{
            externalId: `bw:${Buffer.from(url).toString("base64url").slice(0, 40)}`,
            title: text.split("\n").find((l: string) => l.trim().length > 3)?.slice(0, 120) ?? url,
            body: text.slice(0, 20_000),
            url,
            contentType: "WEB_PAGE",
            language: /[\u0600-\u06FF]/.test(text.slice(0, 500)) ? "ar" : "en",
            rawData: { platform: rt.platform, via: data.via ?? "browser", browserTask: true } as Prisma.InputJsonValue,
            viaType: "BROWSER",
            viaQuery: url,
          }])
          summary = `PUBLIC_FETCH: ليدز=${r.leadsByPlatform ? Object.values(r.leadsByPlatform).reduce((a, b) => a + b, 0) : 0} محتوى=${r.created} تكرار=${r.duplicates}`
        } else summary = "PUBLIC_FETCH: لا مصدر نشط للإدخال — النص متجاهل بأمان"
      }
    } catch (err) {
      // إدخال فشل ≠ إخفاء النتيجة — نسجل الفشل صريحًا ونعتبر المهمة فاشلة قابلة لإعادة
      const msg = err instanceof Error ? err.message.slice(0, 300) : "خطأ إدخال"
      await db.job.update({ where: { id: job.id }, data: { status: job.attempts >= job.maxAttempts ? "FAILED" : "RETRYING", completedAt: job.attempts >= job.maxAttempts ? new Date() : null, errorMessage: `ingest: ${msg}`, scheduledAt: new Date(Date.now() + (policy?.retryPolicy.backoffBaseMs ?? 60_000) * Math.pow(2, job.attempts)) } })
      await db.browserRuntime.update({ where: { id: rt.id }, data: { tasksCompleted: { increment: 1 }, currentTask: null, lastHeartbeat: new Date() } })
      await recordEvent(rt.workspaceId, "TASK_FAILED", { platform: rt.platform, browserId, generation: rt.generation, detail: { jobId, note: `ingest: ${msg}` } })
      return { ok: false, summary: `فشل الإدخال: ${msg}` }
    }

    await db.job.update({ where: { id: job.id }, data: { status: "SUCCESS", completedAt: new Date(), result: { message: summary, via: "browser-runtime", platform: rt.platform, generation: rt.generation } as Prisma.InputJsonValue, errorMessage: null } })
    await db.browserRuntime.update({ where: { id: rt.id }, data: { tasksCompleted: { increment: 1 }, currentTask: null, lastHeartbeat: new Date() } })
    await recordEvent(rt.workspaceId, "TASK_DONE", { platform: rt.platform, browserId, generation: rt.generation, detail: { jobId, task: (job.payload as { task?: string }).task, summary } })
    // مهمة موثقة نجحت → الجلسة استُخدمت بنجاح (lastSuccessfulUse)
    const taskName = String((job.payload as { task?: string }).task ?? "")
    if (taskName === "GROUPS_SCAN" || taskName === "RADAR_SCAN") {
      await markSessionUsed(rt.workspaceId, rt.platform)
    }
    return { ok: true, summary }
  }

  // فشل — وفق سياسة إعادة المحاولة للمنصة (§8 retryPolicy)
  const attempts = job.attempts
  const maxAttempts = policy?.retryPolicy.maxAttempts ?? job.maxAttempts
  const permanent = attempts >= Math.min(maxAttempts, job.maxAttempts)
  const msg = (completion.note ?? "فشل غير محدد").slice(0, 400)
  await db.job.update({
    where: { id: job.id },
    data: {
      status: permanent ? "FAILED" : "RETRYING",
      completedAt: permanent ? new Date() : null,
      errorMessage: msg,
      scheduledAt: permanent ? undefined : new Date(Date.now() + (policy?.retryPolicy.backoffBaseMs ?? 60_000) * Math.pow(2, attempts)),
    },
  })
  await db.browserRuntime.update({ where: { id: rt.id }, data: { lastHeartbeat: new Date(), lastError: msg.slice(0, 200) } })
  await recordEvent(rt.workspaceId, "TASK_FAILED", { platform: rt.platform, browserId, generation: rt.generation, detail: { jobId, task: (job.payload as { task?: string }).task, note: msg, permanent } })
  // فشل جلسة؟ الجلسة تتدهور صريحًا (§11)
  if (/login|checkpoint|session|تسجيل الدخول/i.test(msg) && completion.data?.sessionHealth !== undefined) {
    await recordSessionHealth(rt.workspaceId, rt.platform, completion.data.sessionHealth, msg.slice(0, 200), rt.generation)
  }
  return { ok: false, summary: msg }
}

export interface FinishResult {
  ok: boolean
  closed: boolean
  dispatch: {
    shouldDispatch: boolean
    platform: string
    nextGeneration: number
    parentRunId: string
    childRunId: string
    triggerType: "SELF_DISPATCH"
    delayMs: number
    additionalDispatches: number
    queueDepth: number
  } | null
  note?: string
}

/** إنهاء الجيل: المتصفح يُغلق مرة واحدة هنا فقط (§2/§12) + حفظ الجلسة + قرار الـself-dispatch (§23) */
export async function finishGeneration(browserId: string, opts: {
  closeReason?: "JOB_END" | "CRASH" | "SESSION_CORRUPTION" | "FATAL_ERROR" | "PLATFORM_RESET"
  storageState?: string | null
  sessionHealth?: "READY" | "HEALTHY" | "DEGRADED" | "EXPIRED" | "NEEDS_SESSION" | "FAILED" | "RECOVERING"
  cookieCount?: number
  note?: string
}): Promise<FinishResult> {
  const rt = await db.browserRuntime.findUnique({ where: { browserId } })
  if (!rt) return { ok: false, closed: false, dispatch: null, note: "browser غير معروف" }
  const policy = policyFor(rt.platform)
  const closeReason = opts.closeReason ?? "JOB_END"

  // 1) جوبات لم تكتمل → ترجع للطابور (لا ضياع عمل)
  const requeued = await db.job.updateMany({
    where: { workerId: WORKER_PREFIX + browserId, status: "RUNNING" },
    data: { status: "QUEUED", lockedAt: null, workerId: null, scheduledAt: new Date() },
  })

  // 2) إغلاق المتصفح مرة واحدة في نهاية الـJob — الإغلاقات القاتلة (crash/fatal/فساد جلسة) تُعلَّم FAILED
  await db.browserRuntime.update({
    where: { id: rt.id },
    data: { status: ["CRASH", "FATAL_ERROR", "SESSION_CORRUPTION"].includes(closeReason) ? "FAILED" : "CLOSED", closedAt: new Date(), closeReason, lastError: opts.note?.slice(0, 300) ?? null, currentTask: null },
  })
  await recordEvent(rt.workspaceId, "BROWSER_CLOSE", {
    platform: rt.platform, browserId, generation: rt.generation,
    detail: { closeReason, tasksCompleted: rt.tasksCompleted, requeuedJobs: requeued.count, note: opts.note?.slice(0, 200) ?? null },
  })

  // 3) حفظ حالة الجلسة للجيل التالي (version++ مع كل حفظ)
  let savedVersion: number | null = null
  if (opts.storageState) {
    const saved = await saveSessionState(rt.workspaceId, rt.platform, {
      storageState: opts.storageState, health: opts.sessionHealth ?? "HEALTHY",
      generation: rt.generation, ghRunId: rt.ghRunId, cookieCount: opts.cookieCount, successfulUse: true,
      note: opts.note?.slice(0, 160),
    })
    savedVersion = saved.version
  } else if (opts.sessionHealth) {
    await recordSessionHealth(rt.workspaceId, rt.platform, opts.sessionHealth, opts.note ?? "تحديث صحة عند الإغلاق", rt.generation)
  }

  // 4) قرار الـdispatch — جيل جديد فقط عند الحاجة الفعلية (طابور له شغل) واحترام cooldown (§23)
  const queuedAll = await db.job.findMany({
    where: { workspaceId: rt.workspaceId, type: "BROWSER_SCAN", status: { in: ["QUEUED", "RETRYING"] } },
    select: { payload: true },
    take: 300,
  })
  const isSamePlatform = (j: { payload: unknown }) => ((j.payload as { platform?: string } | null)?.platform === rt.platform)
  const depth = queuedAll.filter(isSamePlatform).length
  const depthAll = queuedAll.length
  const cooldownMs = policy?.cooldownAfterGenerationMs ?? 120_000
  const shouldDispatch = depth > 0 && closeReason !== "SESSION_CORRUPTION"
  // توسّع ضمن السعة: لو الطابور أكبر من دفعة جيل واحد — dispatch إضافي (لا بلا حدود — Cap من السياسة)
  let additionalDispatches = 0
  if (shouldDispatch && policy) {
    const perGen = policy.maxJobsPerGeneration
    additionalDispatches = Math.min(Math.max(0, Math.ceil(depth / perGen) - 1), Math.max(0, policy.maxConcurrentBrowsers - 1))
  }
  const parentRunId = browserId
  const childRunId = `bgen-${randomUUID().slice(0, 12)}`
  const dispatch = {
    shouldDispatch, platform: rt.platform, nextGeneration: rt.generation + 1,
    parentRunId, childRunId, triggerType: "SELF_DISPATCH" as const,
    delayMs: shouldDispatch ? cooldownMs : 0, additionalDispatches, queueDepth: depth,
  }
  await recordEvent(rt.workspaceId, "DISPATCH", {
    platform: rt.platform, browserId, generation: rt.generation, ghRunId: rt.ghRunId,
    detail: { ...dispatch, sessionStateVersion: savedVersion, requeuedJobs: requeued.count, queueDepthAllPlatforms: depthAll },
  })
  return {
    ok: true, closed: true, dispatch,
    note: `الجيل ${rt.generation} اكتمل (${closeReason}) — جلسة محفوظة v${savedVersion ?? "بدون تغيير"} — ${shouldDispatch ? `dispatch للجيل ${rt.generation + 1} بعد ${Math.round(cooldownMs / 1000)}s` : "لا dispatch (لا شغل مستحق)"}${requeued.count ? ` — ${requeued.count} جوبة أُعيدت للطابور` : ""}`,
  }
}
