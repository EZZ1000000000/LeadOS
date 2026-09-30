// LeadOS — Platform Capability Matrix (SESSIONLESS / GRACEFUL DEGRADATION)
// المصدر الوحيد للحقيقة لكل منصة: ما يعمل بدون جلسة، وما يحتاج جلسة، والبديل الآمن.
// القاعدة: ONE MISSING SESSION ≠ DISCOVERY STOP — الجلسة الناقصة حالة معروفة (NEEDS_SESSION) مش كارثة.
import { db } from "@/lib/db"
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto"

export type TriState = "YES" | "PARTIAL" | "NO"
export type NeedsSessionPolicy = "NEVER" | "ONLY_WHEN_REQUIRED"
export type SessionState =
  | "NOT_CONFIGURED" | "READY" | "WARMING" | "EXPIRED"
  | "NEEDS_SESSION" | "BLOCKED" | "ERROR" | "PAUSED"
export type RuntimeMode = "FULL" | "SESSIONLESS" | "DEGRADED" | "STOPPED"
export const RUNTIME_MODES_SET = new Set<string>(["FULL", "SESSIONLESS", "DEGRADED", "STOPPED"])

export interface PlatformCapability {
  platform: string
  label: string
  publicSearch: TriState
  publicRead: TriState
  authenticatedRead: TriState
  authenticatedWrite: TriState
  needsSession: NeedsSessionPolicy
  /** متغيرات البيئة الاختيارية للجلسة — غيابها لا يفشل أي شيء */
  requiredCredential: string[]
  /** سلسلة البدائل الآمنة بترتيب المحاولة */
  fallback: string[]
  /** ما يشتغل فعلًا بدون أي جلسة */
  publicAdapters: string[]
  /** عمليات تحتاج جلسة فعلًا — تُسجل NEEDS_SESSION في غيابها */
  sessionOnlyOps: string[]
}

/**
 * المصفوفة الكاملة — لا تفترض أن كل منصة تحتاج Session.
 * REDDIT/TELEGRAM/GOOGLE_MAPS/RSS/WEB تعمل كاملة بدون جلسات أصلًا.
 */
export const PLATFORM_CAPABILITIES: PlatformCapability[] = [
  {
    platform: "FACEBOOK", label: "فيسبوك",
    publicSearch: "YES", publicRead: "PARTIAL", authenticatedRead: "YES", authenticatedWrite: "YES",
    needsSession: "ONLY_WHEN_REQUIRED", requiredCredential: ["FACEBOOK_SESSION_COOKIE"],
    fallback: ["SERP site:facebook.com", "Jina Reader", "Public pages/events/ads-library"],
    publicAdapters: ["site: search", "ADS_LIBRARY", "EVENTS", "pages"],
    sessionOnlyOps: ["groups authenticated scan", "Radar instant scan"],
  },
  {
    platform: "INSTAGRAM", label: "إنستجرام",
    publicSearch: "YES", publicRead: "PARTIAL", authenticatedRead: "YES", authenticatedWrite: "YES",
    needsSession: "ONLY_WHEN_REQUIRED", requiredCredential: ["INSTAGRAM_SESSION_COOKIE"],
    fallback: ["SERP site:instagram.com", "Jina Reader", "Public profile pages"],
    publicAdapters: ["site: search", "profiles via SERP"],
    sessionOnlyOps: ["authenticated browsing"],
  },
  {
    platform: "LINKEDIN", label: "لينكدإن",
    publicSearch: "YES", publicRead: "PARTIAL", authenticatedRead: "YES", authenticatedWrite: "YES",
    needsSession: "ONLY_WHEN_REQUIRED", requiredCredential: ["LINKEDIN_SESSION_COOKIE"],
    fallback: ["SERP site:linkedin.com", "Jina Reader", "Public /company/ pages", "JOBS public listings"],
    publicAdapters: ["site: search", "company pages", "JOBS"],
    sessionOnlyOps: ["authenticated feed/connections"],
  },
  {
    platform: "X", label: "X / تويتر",
    publicSearch: "YES", publicRead: "PARTIAL", authenticatedRead: "YES", authenticatedWrite: "YES",
    needsSession: "ONLY_WHEN_REQUIRED", requiredCredential: ["X_SESSION_COOKIE"],
    fallback: ["SERP site:x.com", "Jina Reader"],
    publicAdapters: ["site: search"],
    sessionOnlyOps: ["authenticated timeline/DMs"],
  },
  {
    platform: "TIKTOK", label: "تيك توك",
    publicSearch: "YES", publicRead: "PARTIAL", authenticatedRead: "YES", authenticatedWrite: "PARTIAL",
    needsSession: "ONLY_WHEN_REQUIRED", requiredCredential: ["TIKTOK_SESSION_COOKIE"],
    fallback: ["SERP site:tiktok.com", "Jina Reader", "Public video pages"],
    publicAdapters: ["site: search"],
    sessionOnlyOps: ["authenticated actions"],
  },
  {
    platform: "DISCORD", label: "ديسكورد",
    publicSearch: "YES", publicRead: "PARTIAL", authenticatedRead: "YES", authenticatedWrite: "YES",
    needsSession: "ONLY_WHEN_REQUIRED", requiredCredential: ["DISCORD_SESSION_COOKIE"],
    fallback: ["SERP discord servers", "public invite pages"],
    publicAdapters: ["site: search"],
    sessionOnlyOps: ["private servers"],
  },
  {
    platform: "REDDIT", label: "ريديت",
    publicSearch: "YES", publicRead: "YES", authenticatedRead: "YES", authenticatedWrite: "PARTIAL",
    needsSession: "NEVER", requiredCredential: ["REDDIT_SESSION_COOKIE (اختياري للقراءة العامة)"],
    fallback: ["Reddit JSON API", "SERP site:reddit.com", "Jina Reader"],
    publicAdapters: ["reddit_json adapter (بدون مفاتيح)"],
    sessionOnlyOps: ["posting/voting"],
  },
  {
    platform: "YOUTUBE", label: "يوتيوب",
    publicSearch: "YES", publicRead: "PARTIAL", authenticatedRead: "YES", authenticatedWrite: "PARTIAL",
    needsSession: "ONLY_WHEN_REQUIRED", requiredCredential: ["YOUTUBE_SESSION_COOKIE"],
    fallback: ["SERP site:youtube.com", "Jina Reader"],
    publicAdapters: ["site: search", "public watch pages"],
    sessionOnlyOps: ["authenticated owner actions"],
  },
  {
    platform: "TELEGRAM", label: "تليجرام",
    publicSearch: "YES", publicRead: "YES", authenticatedRead: "YES", authenticatedWrite: "PARTIAL",
    needsSession: "NEVER", requiredCredential: ["TELEGRAM_SESSION_COOKIE (اختياري للقنوات العامة)"],
    fallback: ["t.me/s/<channel> public HTML", "SERP site:t.me", "Jina Reader"],
    publicAdapters: ["telegram_public adapter (قنوات عامة)"],
    sessionOnlyOps: ["private channels/groups"],
  },
  {
    platform: "GOOGLE_MAPS", label: "خرائط جوجل",
    publicSearch: "YES", publicRead: "YES", authenticatedRead: "NO", authenticatedWrite: "NO",
    needsSession: "NEVER", requiredCredential: ["GOOGLE_MAPS_API_KEY (مفتاح API — ليس جلسة)"],
    fallback: ["Serper Places", "Google Places API", "SERP maps links"],
    publicAdapters: ["serper_places", "google_places"],
    sessionOnlyOps: [],
  },
  {
    platform: "WEB", label: "بحث الويب المفتوح",
    publicSearch: "YES", publicRead: "YES", authenticatedRead: "NO", authenticatedWrite: "NO",
    needsSession: "NEVER", requiredCredential: ["مفاتيح البحث اختيارية (سلسلة 6 مزودين + z-ai مدمج)"],
    fallback: ["Serper → Tavily → SerpAPI → Exa → SearXNG → z-ai", "Jina Reader"],
    publicAdapters: ["web_search", "NEWS", "RSS"],
    sessionOnlyOps: [],
  },
  {
    platform: "DIRECTORY", label: "أدلة الأعمال",
    publicSearch: "YES", publicRead: "PARTIAL", authenticatedRead: "NO", authenticatedWrite: "NO",
    needsSession: "NEVER", requiredCredential: [],
    fallback: ["SERP site:yellowpages…", "Jina Reader", "Skip safely"],
    publicAdapters: ["site: search"],
    sessionOnlyOps: [],
  },
  {
    platform: "JOBS", label: "مواقع التوظيف",
    publicSearch: "YES", publicRead: "PARTIAL", authenticatedRead: "NO", authenticatedWrite: "NO",
    needsSession: "NEVER", requiredCredential: [],
    fallback: ["SERP site:wuzzuf…", "Jina Reader"],
    publicAdapters: ["site: search"],
    sessionOnlyOps: [],
  },
  {
    platform: "MARKETPLACE", label: "مواقع البيع",
    publicSearch: "YES", publicRead: "PARTIAL", authenticatedRead: "NO", authenticatedWrite: "NO",
    needsSession: "NEVER", requiredCredential: [],
    fallback: ["SERP site:olx…", "Jina Reader"],
    publicAdapters: ["site: search"],
    sessionOnlyOps: [],
  },
  {
    platform: "FREELANCE", label: "العمل الحر",
    publicSearch: "YES", publicRead: "PARTIAL", authenticatedRead: "NO", authenticatedWrite: "NO",
    needsSession: "NEVER", requiredCredential: [],
    fallback: ["SERP site:mostaql…", "Jina Reader"],
    publicAdapters: ["site: search"],
    sessionOnlyOps: [],
  },
  {
    platform: "QUORA", label: "Quora",
    publicSearch: "YES", publicRead: "PARTIAL", authenticatedRead: "NO", authenticatedWrite: "NO",
    needsSession: "NEVER", requiredCredential: [],
    fallback: ["SERP site:quora.com", "Jina Reader"],
    publicAdapters: ["site: search"],
    sessionOnlyOps: [],
  },
  {
    platform: "EVENTS", label: "المناسبات",
    publicSearch: "YES", publicRead: "PARTIAL", authenticatedRead: "NO", authenticatedWrite: "NO",
    needsSession: "NEVER", requiredCredential: [],
    fallback: ["SERP site:facebook.com/events…", "Jina Reader"],
    publicAdapters: ["site: search"],
    sessionOnlyOps: [],
  },
  {
    platform: "REVIEWS", label: "التقييمات",
    publicSearch: "YES", publicRead: "PARTIAL", authenticatedRead: "NO", authenticatedWrite: "NO",
    needsSession: "NEVER", requiredCredential: [],
    fallback: ["SERP tripadvisor/elmenus", "Google Maps public", "Jina Reader"],
    publicAdapters: ["site: search"],
    sessionOnlyOps: [],
  },
  {
    platform: "ADS_LIBRARY", label: "مكتبة إعلانات ميتا",
    publicSearch: "YES", publicRead: "YES", authenticatedRead: "NO", authenticatedWrite: "NO",
    needsSession: "NEVER", requiredCredential: [],
    fallback: ["SERP facebook.com/ads/library", "Jina Reader"],
    publicAdapters: ["site: search (عامة بلا جلسة)"],
    sessionOnlyOps: [],
  },
  {
    platform: "WHATSAPP", label: "واتساب (قناة زيزو)",
    publicSearch: "NO", publicRead: "NO", authenticatedRead: "NO", authenticatedWrite: "YES",
    needsSession: "ONLY_WHEN_REQUIRED", requiredCredential: ["WHATSAPP_NUMBER / Evolution config"],
    fallback: ["قنوات أخرى متاحة (MANUAL/WEB/TELEGRAM)"],
    publicAdapters: [],
    sessionOnlyOps: ["outbound messaging"],
  },
]

/** متغير env الخاص بجلسة كل منصة */
export function sessionEnvVar(platform: string): string | null {
  const map: Record<string, string> = {
    FACEBOOK: "FACEBOOK_SESSION_COOKIE", INSTAGRAM: "INSTAGRAM_SESSION_COOKIE",
    LINKEDIN: "LINKEDIN_SESSION_COOKIE", X: "X_SESSION_COOKIE", TIKTOK: "TIKTOK_SESSION_COOKIE",
    DISCORD: "DISCORD_SESSION_COOKIE", TELEGRAM: "TELEGRAM_SESSION_COOKIE",
    REDDIT: "REDDIT_SESSION_COOKIE", YOUTUBE: "YOUTUBE_SESSION_COOKIE",
  }
  return map[platform.toUpperCase()] ?? null
}

export const SESSION_PLATFORMS = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "X", "TIKTOK", "DISCORD", "TELEGRAM", "REDDIT", "YOUTUBE"]

// ══════════ تشفير الجلسات (AES-256-GCM) — الكوكي لا يُخزن ولا يُعرض أبدًا كنص صريح ══════════
const encKey = () => scryptSync(process.env.AUTH_SECRET || "leados-dev-secret-change-in-production", "leados-sessions-v1", 32)

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${enc.toString("base64")}`
}

export function decryptSecret(cipherText: string): string | null {
  try {
    const [ivB64, tagB64, dataB64] = cipherText.split(".")
    if (!ivB64 || !tagB64 || !dataB64) return null
    const decipher = createDecipheriv("aes-256-gcm", encKey(), Buffer.from(ivB64, "base64"))
    decipher.setAuthTag(Buffer.from(tagB64, "base64"))
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8")
  } catch {
    return null
  }
}

/** إخفاء الكوكي في أي مكان قد يُسجل — نحتفظ ببصمة قصيرة فقط للمطابقة البشرية */
export function maskCookie(c: string): string {
  const trimmed = c.trim()
  if (trimmed.length <= 12) return "••••••"
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)} (${trimmed.length} حرف)`
}

// ══════════ قراءة الجلسات: قاعدة البيانات أولًا ثم env — كلاهما اختياري ══════════

export interface SessionInfo {
  state: SessionState
  source: "db" | "env" | null
  lastVerifiedAt: Date | null
  expiresAt: Date | null
  lastError: string | null
  accountId: string | null
  maskedHint: string | null
}

/** جدول PlatformAccount قد لا يكون موجودًا بعد على الإنتاج — الفشل آمن ويرجع NOT_CONFIGURED */
async function dbSessionOf(platform: string) {
  try {
    return await db.platformAccount.findFirst({
      where: { platform, kind: "SESSION", status: { not: "PAUSED" } },
      orderBy: { updatedAt: "desc" },
    })
  } catch {
    return null
  }
}

/** حالة الجلسة لمنصة — الحساب غير موجود = NOT_CONFIGURED (وليس خطأ نظام) */
export async function sessionStatusOf(platform: string): Promise<SessionInfo> {
  const acc = await dbSessionOf(platform)
  if (acc) {
    const state = acc.status as SessionState
    const expired = acc.expiresAt && acc.expiresAt < new Date()
    const effective: SessionState = expired && state === "READY" ? "EXPIRED" : state
    return {
      state: effective,
      source: "db",
      lastVerifiedAt: acc.lastVerifiedAt,
      expiresAt: acc.expiresAt,
      lastError: acc.lastError,
      accountId: acc.id,
      maskedHint: acc.label ?? null,
    }
  }
  const envVar = sessionEnvVar(platform)
  if (envVar && process.env[envVar]) {
    return { state: "READY", source: "env", lastVerifiedAt: null, expiresAt: null, lastError: null, accountId: null, maskedHint: `${envVar} (env)` }
  }
  return { state: "NOT_CONFIGURED", source: null, lastVerifiedAt: null, expiresAt: null, lastError: null, accountId: null, maskedHint: null }
}

/** كوكي الجلسة الفعلي للتنفيذ — DB مشفرًا ثم env. لا يُسجل ولا يُعرض أبدًا */
export async function sessionCookieOf(platform: string): Promise<{ cookie: string | null; source: "db" | "env" | null }> {
  const acc = await dbSessionOf(platform)
  if (acc?.sessionCipher) {
    const plain = decryptSecret(acc.sessionCipher)
    if (plain) return { cookie: plain, source: "db" }
  }
  const envVar = sessionEnvVar(platform)
  if (envVar && process.env[envVar]) return { cookie: process.env[envVar] as string, source: "env" }
  return { cookie: null, source: null }
}

/** هل العملية دي محتاجة جلسة؟ لو محتاجة ومفيش → NEEDS_SESSION (حالة آمنة مش كارثة) */
export async function capabilityFor(platform: string, op: "public" | "authenticated"): Promise<"OK" | "NEEDS_SESSION"> {
  if (op === "public") return "OK"
  const s = await sessionStatusOf(platform)
  return s.state === "READY" || s.state === "WARMING" ? "OK" : "NEEDS_SESSION"
}

// ══════════ وضع التشغيل ══════════

/** نقي — يُستخدم في الاختبارات والمحاكاة بدون قاعدة بيانات */
export function computeRuntimeMode(
  sessionStates: SessionState[],
  opts?: { stopped?: boolean; publicSourcesBroken?: boolean },
): RuntimeMode {
  if (opts?.stopped) return "STOPPED"
  const ready = sessionStates.filter((s) => s === "READY" || s === "WARMING").length
  const broken = sessionStates.filter((s) => s === "EXPIRED" || s === "BLOCKED" || s === "ERROR").length
  if (ready === 0 && broken === 0) return "SESSIONLESS"
  if (ready > 0 && broken === 0 && !opts?.publicSourcesBroken) return "FULL"
  return "DEGRADED"
}

export async function currentRuntimeMode(): Promise<{ mode: RuntimeMode; reason: string }> {
  try {
    const flag = await db.systemState.findUnique({ where: { id: "singleton" } }).catch(() => null)
    if (flag?.state === "STOPPED") return { mode: "STOPPED", reason: "مفتاح إيقاف عام مُفعّل" + (flag.stoppedBy ? " (" + flag.stoppedBy + ")" : "") }
    if (process.env.LEADOS_RUNTIME_MODE === "STOPPED") return { mode: "STOPPED", reason: "LEADOS_RUNTIME_MODE=STOPPED" }
  } catch { /* جدول قد لا يكون موجودًا — نكمل عادي */ }
  const states: SessionState[] = []
  for (const p of SESSION_PLATFORMS) states.push((await sessionStatusOf(p)).state)
  const mode = computeRuntimeMode(states)
  return {
    mode,
    reason: mode === "SESSIONLESS"
      ? "لا توجد أي جلسات — النظام يعمل على المسارات العامة بالكامل"
      : mode === "FULL"
        ? "كل الجلسات المضافة صالحة والمصادر العامة تعمل"
        : "بعض الجلسات منتهية أو معطوبة — يعمل المتاح ويُسجل الباقي",
  }
}

/** تغيير مفتاح الإيقاف العام — STOPPED يوقف النبضات، RUNNING يرجع للحساب التلقائي */
export async function setGlobalStop(stopped: boolean, by: string): Promise<void> {
  const now = new Date()
  await db.systemState.upsert({
    where: { id: "singleton" },
    update: stopped
      ? { state: "STOPPED", stoppedAt: now, stoppedBy: by }
      : { state: "RUNNING", resumedAt: now, resumedBy: by },
    create: stopped
      ? { id: "singleton", state: "STOPPED", stoppedAt: now, stoppedBy: by }
      : { id: "singleton", state: "RUNNING", resumedAt: now, resumedBy: by },
  })
}

// ══════════ مصفوفة اللوحة (بدون أي قيم سرية) ══════════

export interface MatrixRow {
  platform: string
  label: string
  publicSearch: TriState
  publicRead: TriState
  authenticatedRead: TriState
  authenticatedWrite: TriState
  needsSession: NeedsSessionPolicy
  sessionState: SessionState
  sessionSource: "db" | "env" | null
  lastVerifiedAt: string | null
  currentCapability: "READY" | "PUBLIC_ONLY" | "NEEDS_SESSION" | "ERROR"
  fallback: string[]
  sessionOnlyOps: string[]
}

export async function capabilityMatrix(): Promise<{ mode: RuntimeMode; reason: string; rows: MatrixRow[] }> {
  const { mode, reason } = await currentRuntimeMode()
  const rows: MatrixRow[] = []
  for (const cap of PLATFORM_CAPABILITIES) {
    const s = await sessionStatusOf(cap.platform)
    const hasPublic = cap.publicSearch !== "NO" || cap.publicRead !== "NO"
    const currentCapability: MatrixRow["currentCapability"] =
      s.state === "ERROR" || s.state === "BLOCKED" ? "ERROR"
        : s.state === "READY" || s.state === "WARMING" ? "READY"
          : hasPublic ? "PUBLIC_ONLY" : "NEEDS_SESSION"
    rows.push({
      platform: cap.platform, label: cap.label,
      publicSearch: cap.publicSearch, publicRead: cap.publicRead,
      authenticatedRead: cap.authenticatedRead, authenticatedWrite: cap.authenticatedWrite,
      needsSession: cap.needsSession,
      sessionState: s.state, sessionSource: s.source,
      lastVerifiedAt: s.lastVerifiedAt ? s.lastVerifiedAt.toISOString() : null,
      currentCapability, fallback: cap.fallback, sessionOnlyOps: cap.sessionOnlyOps,
    })
  }
  return { mode, reason, rows }
}

// ══════════ ضمان وجود جداول الجلسات (إنتاج Postgres) — idempotent وآمن ══════════

let tablesEnsured = false

/**
 * على الإنتاج جدول PlatformAccount/SystemState قد لا يكون مرحّلًا بعد —
 * أول نداء لطبقة الجلسات يضمن وجودهما (CREATE TABLE IF NOT EXISTS).
 * محليًا (SQLite) الجداول موجودة من prisma db push — نتخطى.
 */
export async function ensureSessionTables(): Promise<{ ensured: boolean; dialect: string }> {
  if (tablesEnsured) return { ensured: true, dialect: "cached" }
  const url = process.env.DATABASE_URL ?? ""
  if (url.startsWith("file:")) {
    tablesEnsured = true
    return { ensured: true, dialect: "sqlite" }
  }
  if (!url.startsWith("postgres")) return { ensured: false, dialect: "unknown" }
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PlatformAccount" (
        "id" TEXT PRIMARY KEY,
        "workspaceId" TEXT NOT NULL,
        "platform" TEXT NOT NULL,
        "handle" TEXT NOT NULL,
        "label" TEXT,
        "kind" TEXT NOT NULL DEFAULT 'OUTBOX',
        "status" TEXT NOT NULL DEFAULT 'WARMING',
        "dailyLimit" INTEGER NOT NULL DEFAULT 20,
        "sentToday" INTEGER NOT NULL DEFAULT 0,
        "lastSentAt" TIMESTAMP(3),
        "cooldownUntil" TIMESTAMP(3),
        "sessionCipher" TEXT,
        "sessionMeta" JSONB,
        "lastVerifiedAt" TIMESTAMP(3),
        "expiresAt" TIMESTAMP(3),
        "lastError" TEXT,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PlatformAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PlatformAccount_workspaceId_platform_handle_key" ON "PlatformAccount"("workspaceId","platform","handle")`)
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PlatformAccount_workspaceId_platform_status_idx" ON "PlatformAccount"("workspaceId","platform","status")`)
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PlatformAccount_platform_kind_idx" ON "PlatformAccount"("platform","kind")`)
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SystemState" ("key" TEXT PRIMARY KEY, "value" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
    tablesEnsured = true
    return { ensured: true, dialect: "postgres" }
  } catch {
    return { ensured: false, dialect: "postgres" }
  }
}

// ══════════ التنبيهات — session missing ليس خطأ Critical ══════════

/** تنبيه بحالة الجلسة بدون سبام: نفس النوع/المنصة مرة كل 24 ساعة */
export async function sessionStateAlert(wsId: string, platform: string, state: SessionState, note?: string): Promise<void> {
  const severity: string = state === "READY" ? "INFO"
    : state === "EXPIRED" ? "MEDIUM"
      : state === "NOT_CONFIGURED" || state === "NEEDS_SESSION" ? "INFO"
        : "HIGH"
  const title: string = state === "NOT_CONFIGURED" ? `جلسة ${platform} غير مضافة — يعمل المسار العام`
    : state === "READY" ? `جلسة ${platform} جاهزة — فُتحت القدرات الموثقة`
      : state === "EXPIRED" ? `جلسة ${platform} انتهت — يجب تجديدها`
        : `جلسة ${platform}: ${state}`
  try {
    const dayAgo = new Date(Date.now() - 24 * 3600_000)
    const recent = await db.alert.findFirst({
      where: { workspaceId: wsId, type: `SESSION_${state}`, message: { contains: platform } },
      orderBy: { createdAt: "desc" },
    }).catch(() => null)
    if (recent && recent.createdAt > dayAgo) return
    await db.alert.create({
      data: {
        workspaceId: wsId, type: `SESSION_${state}`, title, message: note ?? title,
        severity, actionUrl: "/settings",
      },
    })
  } catch { /* التنبيه اختياري — لا يوقف شيئًا */ }
}

// ══════════ Queue: إعادة تشغيل المهام المنتظرة عند وصول الجلسة ══════════

/** WAITING_FOR_CAPABILITY → QUEUED تلقائيًا عند إضافة/تجديد جلسة منصة */
export async function requeueWaitingJobs(platform?: string): Promise<number> {
  try {
    const jobs = await db.job.findMany({
      where: { status: "WAITING_FOR_CAPABILITY" },
      select: { id: true, payload: true },
    })
    const ids = jobs
      .filter((j) => {
        if (!platform) return true
        const p = (j.payload as { platform?: string } | null)?.platform
        return !p || p === platform
      })
      .map((j) => j.id)
    if (!ids.length) return 0
    const res = await db.job.updateMany({
      where: { id: { in: ids } },
      data: { status: "QUEUED", scheduledAt: new Date(), errorMessage: null },
    })
    return res.count
  } catch {
    return 0
  }
}

// ══════════ دالة تقييم نقيّة — لمحاكاة التحول SESSIONLESS → FULL بدون بيانات وهمية في الإنتاج ══════════

export interface FakeAccountInput { platform: string; status: SessionState; hasCipher?: boolean; expiresAt?: Date | null }

/**
 * محاكاة كشف الجلسة المضافة: نفس منطق sessionStatusOf لكن نقيّ —
 * تُستخدم في scripts/sessionless-audit.ts لاختبار تبديل القدرات داخل بيئة اختبار فقط.
 */
export function evaluateCapabilities(
  accounts: FakeAccountInput[],
  envHas: Record<string, boolean>,
): Array<{ platform: string; before: SessionState; after: SessionState; authenticatedUnlocked: boolean }> {
  const out: Array<{ platform: string; before: SessionState; after: SessionState; authenticatedUnlocked: boolean }> = []
  for (const cap of PLATFORM_CAPABILITIES) {
    const envVar = sessionEnvVar(cap.platform)
    const dbAcc = accounts.find((a) => a.platform === cap.platform && a.status !== "PAUSED")
    let before: SessionState = "NOT_CONFIGURED"
    if (envVar && envHas[envVar]) before = "READY"
    let after: SessionState = before
    if (dbAcc?.hasCipher) {
      const expired = dbAcc.expiresAt && dbAcc.expiresAt < new Date()
      after = expired ? "EXPIRED" : dbAcc.status
    }
    const authenticatedUnlocked: boolean = after === "READY" || after === "WARMING"
    out.push({ platform: cap.platform, before, after, authenticatedUnlocked })
  }
  return out
}
