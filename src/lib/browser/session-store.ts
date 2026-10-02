// LeadOS — Session Store: استمرارية الجلسة بين generations (طلب §3 + §4 + §5 + §11)
// الاستمرارية مبنية على Persistent Session State محفوظ في قاعدة البيانات —
// لا اعتماد على process قديمة (الـrunner الجديد يترك في بدايته ويكمّل).
// الجلسة لا تُعاد إنشاؤها بلا سبب: تُحفظ وتُرقّم بالنسخ (sessionStateVersion) وتُستعاد كما هي.
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { encryptSecret, decryptSecret, sessionCookieOf } from "@/lib/capabilities"
import { recordEvent } from "./pool"

export type BrowserSessionHealth =
  | "READY" | "HEALTHY" | "DEGRADED" | "EXPIRED" | "NEEDS_SESSION" | "FAILED" | "RECOVERING"

export const SESSION_HEALTHS: BrowserSessionHealth[] = ["READY", "HEALTHY", "DEGRADED", "EXPIRED", "NEEDS_SESSION", "FAILED", "RECOVERING"]

/** الجلسات الصالحة للمهام الموثقة — ما عداها: EXPIRED/NEEDS_SESSION/FAILED */
export function sessionUsable(status: string): boolean {
  return ["READY", "HEALTHY", "DEGRADED", "RECOVERING"].includes(status)
}

export interface StoredSession {
  platform: string
  browserProfileId: string
  sessionStateVersion: number
  status: BrowserSessionHealth | "NOT_CONFIGURED"
  storage: string | null      // storage_state كنص JSON — للـrunner فقط عبر قناة مشفّرة، لا يُسجَّل
  lastValidatedAt: Date | null
  lastSuccessfulUse: Date | null
  seededFrom: "browser" | "platform_account" | null
}

function uniqueKey(workspaceId: string, platform: string) {
  return { workspaceId, platform, browserProfileId: `bpf-${platform.toLowerCase()}-01` }
}

/** جلب حالة الجلسة لمنصة — مع بذر ذكي من جلسة المنصة الموجودة (PlatformAccount) لو الحالة لسه مفيش (§4: لا جلسة جديدة بلا سبب) */
export async function loadSessionState(workspaceId: string, platform: string): Promise<StoredSession> {
  const profileId = `bpf-${platform.toLowerCase()}-01`
  const row = await db.browserSessionState.findUnique({
    where: { workspaceId_platform_browserProfileId: uniqueKey(workspaceId, platform) },
  })
  if (row) {
    return {
      platform,
      browserProfileId: row.browserProfileId,
      sessionStateVersion: row.sessionStateVersion,
      status: row.status as StoredSession["status"],
      storage: row.storageCipher ? decryptSecret(row.storageCipher) : null,
      lastValidatedAt: row.lastValidatedAt,
      lastSuccessfulUse: row.lastSuccessfulUse,
      seededFrom: (row.storageMeta as { seededFrom?: string } | null)?.seededFrom === "platform_account" ? "platform_account" : "browser",
    }
  }
  // لا صف بعد — بذور من جلسة المنصة الموجودة لو الجلسة READY (استمرارية فورية، لا جلسة جديدة)
  const cookie = await sessionCookieOf(platform).catch(() => ({ cookie: null, source: null }))
  if (cookie.cookie) {
    // بذرة صريحة الشكل: الـrunner يحوّل cookieHeader إلى كوكيز داخل المتصفح (نفس الجلسة الموجودة — لا جلسة جديدة)
    const storage = JSON.stringify({ seeded: true, seededFrom: "platform_account", cookieHeader: cookie.cookie, cookieDomain: `.${platform.toLowerCase()}.com` })
    return {
      platform, browserProfileId: profileId, sessionStateVersion: 0,
      status: "READY", storage, lastValidatedAt: null, lastSuccessfulUse: null, seededFrom: "platform_account",
    }
  }
  return {
    platform, browserProfileId: profileId, sessionStateVersion: 0,
    status: "NEEDS_SESSION", storage: null, lastValidatedAt: null, lastSuccessfulUse: null, seededFrom: null,
  }
}

/** حفظ حالة الجلسة بعد جيل ناجح — النسخة تزيد مع كل حفظ (sessionStateVersion++). */
export async function saveSessionState(
  workspaceId: string,
  platform: string,
  opts: {
    storageState?: string | null       // storage_state JSON من Playwright
    health: BrowserSessionHealth
    generation?: number
    ghRunId?: string | null
    note?: string
    cookieCount?: number
    successfulUse?: boolean
  },
): Promise<{ ok: boolean; version: number }> {
  const profileId = `bpf-${platform.toLowerCase()}-01`
  const existing = await db.browserSessionState.findUnique({
    where: { workspaceId_platform_browserProfileId: uniqueKey(workspaceId, platform) },
  })
  const version = (existing?.sessionStateVersion ?? 0) + (opts.storageState ? 1 : 0)
  const data = {
    status: opts.health,
    // النسخة تزيد مع كل حفظ storage فعلي (§3: sessionStateVersion++ مع كل حفظ)
    ...(opts.storageState ? { sessionStateVersion: version } : {}),
    generation: opts.generation ?? existing?.generation ?? 0,
    lastError: opts.health === "EXPIRED" || opts.health === "FAILED" ? (opts.note ?? null) : null,
    ...(opts.storageState
      ? {
          storageCipher: encryptSecret(opts.storageState),
          storageMeta: {
            bytes: opts.storageState.length,
            cookies: opts.cookieCount ?? null,
            savedAt: new Date().toISOString(),
            ghRunId: opts.ghRunId ?? null,
            note: opts.note ?? null,
          } as Prisma.InputJsonValue,
        }
      : {}),
    ...(opts.successfulUse ? { lastSuccessfulUse: new Date() } : {}),
    ...(opts.note && !opts.storageState ? {} : {}),
  }
  if (existing) {
    await db.browserSessionState.update({ where: { id: existing.id }, data })
  } else {
    await db.browserSessionState.create({
      data: {
        workspaceId, platform, browserProfileId: profileId,
        sessionStateVersion: version,
        storageMeta: { note: opts.note ?? null } as Prisma.InputJsonValue,
        ...data,
      },
    })
  }
  await recordEvent(workspaceId, "SESSION_SAVE", {
    platform, generation: opts.generation ?? 0, ghRunId: opts.ghRunId,
    detail: { version, health: opts.health, stored: Boolean(opts.storageState), note: opts.note ?? null },
  })
  return { ok: true, version }
}

/** تسجيل نتيجة فحص صحة دوري (طلب §11) — READY→EXPIRED يوقف المهام الموثقة ويُبقي العامة */
export async function recordSessionHealth(
  workspaceId: string,
  platform: string,
  health: BrowserSessionHealth,
  note: string,
  generation = 0,
): Promise<void> {
  const profileId = `bpf-${platform.toLowerCase()}-01`
  const existing = await db.browserSessionState.findUnique({
    where: { workspaceId_platform_browserProfileId: uniqueKey(workspaceId, platform) },
  })
  if (existing) {
    await db.browserSessionState.update({
      where: { id: existing.id },
      data: { status: health, lastValidatedAt: new Date(), lastError: health === "EXPIRED" || health === "FAILED" ? note : null },
    })
  } else {
    await db.browserSessionState.create({
      data: { workspaceId, platform, browserProfileId: profileId, status: health, lastValidatedAt: new Date(), lastError: health === "EXPIRED" ? note : null },
    })
  }
  await recordEvent(workspaceId, "SESSION_HEALTH", { platform, generation, detail: { health, note } })
}

/** تعليم الجلسة أنها استُخدمت بنجاح في مهمة موثقة */
export async function markSessionUsed(workspaceId: string, platform: string): Promise<void> {
  const profileId = `bpf-${platform.toLowerCase()}-01`
  const existing = await db.browserSessionState.findUnique({
    where: { workspaceId_platform_browserProfileId: uniqueKey(workspaceId, platform) },
  })
  if (existing) await db.browserSessionState.update({ where: { id: existing.id }, data: { lastSuccessfulUse: new Date(), status: existing.status === "RECOVERING" ? "HEALTHY" : existing.status } })
}
