// LeadOS — Compliance Guard (طلب §33 + §34 + §9)
// قبل أي Job متصفح: السياسة محمّلة؟ الحدود معروفة؟ السعة تسمح؟ الجلسة صالحة؟ المهمة مسموحة؟
// أي شرط فشل → BLOCK/QUEUE — لا تنفيذ خارج السياسة إطلاقًا.
// ممنوع نهائيًا: تجاوز CAPTCHA/MFA/ban — عند الحد: BACKOFF → WAIT → RETRY وفق السياسة.
import { db } from "@/lib/db"
import { policyFor, withinActiveHours, type PlatformPolicy } from "./policy"
import { platformPool, globalActiveBrowsers, GLOBAL_BROWSER_LIMIT } from "./pool"
import { sessionUsable, loadSessionState } from "./session-store"

export type GuardBlockReason =
  | "POLICY_MISSING" | "PLATFORM_PAUSED" | "TASK_NOT_ALLOWED" | "SESSION_MISSING"
  | "ACTIVE_HOURS" | "COOLDOWN" | "CAPACITY_LIMIT" | "GLOBAL_LIMIT" | "NO_JOBS"

export interface GuardDecision {
  decision: "ALLOW" | "QUEUE" | "BLOCK"
  reason?: GuardBlockReason
  note?: string
  policy?: PlatformPolicy
}

/** الإيقاف العام للنظام (kill-switch موجود مسبقًا في SystemState) — يوقف المتصفحات أيضًا */
async function globalStopped(): Promise<string | null> {
  try {
    const s = await db.systemState.findUnique({ where: { id: "singleton" }, select: { state: true, reason: true } })
    return s?.state === "STOPPED" ? (s.reason ?? "GLOBAL_STOP") : null
  } catch {
    return null
  }
}

/** هل المنصة في فترة backoff بعد فشل مهامها؟ — TASK_FAILED فقط (فقدان المتصفح لا يمنع التعافي الفوري §25) */
async function inFailureBackoff(workspaceId: string, platform: string, backoffMs: number): Promise<boolean> {
  const cutoff = new Date(Date.now() - backoffMs)
  const ev = await db.browserEvent.findFirst({
    where: { workspaceId, platform, type: "TASK_FAILED", createdAt: { gte: cutoff } },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  })
  return Boolean(ev)
}

/** هل المنصة في cooldown بعد جيل انتهى للتو؟ */
async function inCooldown(workspaceId: string, platform: string, cooldownMs: number): Promise<{ cooling: boolean; until: Date | null }> {
  const lastClose = await db.browserEvent.findFirst({
    where: { workspaceId, platform, type: "BROWSER_CLOSE" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })
  if (!lastClose) return { cooling: false, until: null }
  const until = new Date(lastClose.createdAt.getTime() + cooldownMs)
  return { cooling: until > new Date(), until }
}

/**
 * درع الامتثال — يُستدعى قبل بدء أي جيل (generation) لأي منصة.
 * BLOCK = حقيقي (لا تنفيذ الآن ولا لاحقًا بدون تغيير شرط) — QUEUE = انتظار مؤقت (سيُعاد التقييم).
 */
export async function complianceGuard(
  workspaceId: string,
  platform: string,
  opts?: { taskType?: string; ignoreQueueEmpty?: boolean },
): Promise<GuardDecision> {
  // 1) السياسة محمّلة؟
  const policy = policyFor(platform)
  if (!policy) return { decision: "BLOCK", reason: "POLICY_MISSING", note: `لا يوجد ملف سياسة للمنصة ${platform} — المتصفح لا يعمل بلا سياسة` }

  // 2) الإيقاف العام
  const stopped = await globalStopped()
  if (stopped) return { decision: "BLOCK", reason: "PLATFORM_PAUSED", note: `النظام موقوف عامًا: ${stopped}`, policy }

  // 3) المنصة لها جوبات متصفح أصلًا؟
  if (policy.browserJobs.length === 0) {
    return { decision: "BLOCK", reason: "TASK_NOT_ALLOWED", note: "المنصة بلا جوبات متصفح في سياستها", policy }
  }

  // 4) ساعات النشاط
  if (!withinActiveHours(policy)) {
    return { decision: "QUEUE", reason: "ACTIVE_HOURS", note: `خارج ساعات النشاط (${policy.activeHours.start}-${policy.activeHours.end} ${policy.activeHours.tz})`, policy }
  }

  // 5) backoff بعد فشل
  if (await inFailureBackoff(workspaceId, platform, policy.failureBackoffMs)) {
    return { decision: "QUEUE", reason: "COOLDOWN", note: `المنصة في backoff بعد فشل (${Math.round(policy.failureBackoffMs / 60000)} دقيقة)`, policy }
  }

  // 6) cooldown بعد جيل سابق
  const cd = await inCooldown(workspaceId, platform, policy.cooldownAfterGenerationMs)
  if (cd.cooling) {
    return { decision: "QUEUE", reason: "COOLDOWN", note: `cooldown بعد الجيل السابق حتى ${cd.until?.toISOString() ?? "?"}`, policy }
  }

  // 7) الجلسة صالحة لو المهمة تتطلبها (فحص أول مهمة مؤهلة في الطابور يحدث في startGeneration — هنا نفحص الحالة العامة)
  if (policy.accessMode === "SESSION_REQUIRED") {
    const s = await loadSessionState(workspaceId, platform)
    if (!sessionUsable(s.status)) {
      return { decision: "BLOCK", reason: "SESSION_MISSING", note: `المنصة تتطلب جلسة صالحة — الحالة: ${s.status}`, policy }
    }
  }

  // 8) سعة المنصة
  const pool = await platformPool(workspaceId, platform)
  if (pool.freeSlots <= 0) {
    return { decision: "QUEUE", reason: "CAPACITY_LIMIT", note: `سعة المنصة ممتلئة (${pool.activeCapacity}/${pool.configuredLimit}) — الانتظار في الطابور`, policy }
  }

  // 9) الميزانية العامة
  const globalActive = await globalActiveBrowsers(workspaceId)
  if (globalActive >= GLOBAL_BROWSER_LIMIT) {
    return { decision: "QUEUE", reason: "GLOBAL_LIMIT", note: `السعة العامة ممتلئة (${globalActive}/${GLOBAL_BROWSER_LIMIT})`, policy }
  }

  return { decision: "ALLOW", policy, note: "كل شروط الامتثال مستوفاة" }
}

/** فحص جلسة لمهمة محددة (GROUPS_SCAN/RADAR_SCAN تتطلب جلسة في بعض المنصات) */
export async function taskSessionOk(workspaceId: string, platform: string, taskType: string): Promise<GuardDecision> {
  const policy = policyFor(platform)
  if (!policy) return { decision: "BLOCK", reason: "POLICY_MISSING" }
  if (policy.sessionRequiredJobs.includes(taskType as never)) {
    const s = await loadSessionState(workspaceId, platform)
    if (!sessionUsable(s.status)) {
      return { decision: "BLOCK", reason: "SESSION_MISSING", note: `المهمة ${taskType} تتطلب جلسة — الحالة: ${s.status}`, policy }
    }
  }
  return { decision: "ALLOW", policy }
}
