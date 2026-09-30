// LeadOS — Session Onboarding API (طلب §18/§19/§29/§30)
// إضافة/تحقق/حذف جلسات المنصات بدون تعديل كود — الكوكي سر:
//   لا يُخزن إلا مشفرًا (AES-256-GCM)، لا يُسجل، لا يُرسل للـfrontend أبدًا.
// الرد يعرض فقط: Configured / Valid / Expired / Last checked.
import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import {
  SESSION_PLATFORMS, sessionStatusOf, sessionStateAlert, requeueWaitingJobs,
  encryptSecret, ensureSessionTables, type SessionState,
} from "@/lib/capabilities"

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

/** فحص صحة آمن للجلسة: GET واحد للصفحة الرئيسية — بدون تسجيل دخول ولا تجاوز حماية.
 *  جدار دخول صريح → EXPIRED. خطأ شبكة → نُبقي الحالة مع ملاحظة (مش بنقلّع READY على عتاب شبكة). */
async function healthCheck(platform: string, cookie: string): Promise<{ state: "READY" | "EXPIRED" | "ERROR"; note: string }> {
  const homes: Record<string, string> = {
    FACEBOOK: "https://mbasic.facebook.com/",
    INSTAGRAM: "https://www.instagram.com/accounts/edit/",
    LINKEDIN: "https://www.linkedin.com/feed/",
    X: "https://x.com/home",
    TIKTOK: "https://www.tiktok.com/",
    REDDIT: "https://www.reddit.com/",
    YOUTUBE: "https://www.youtube.com/account",
    TELEGRAM: "https://web.telegram.org/",
    DISCORD: "https://discord.com/channels/@me",
  }
  const url = homes[platform]
  if (!url) return { state: "READY", note: "لا يوجد فحص مخصص للمنصة — محفوظة كمُقدّمة" }
  const loginWall = /log in|sign up|login_form|checkpoint|please log in/i
  try {
    const res = await fetch(url, {
      headers: { Cookie: cookie, "User-Agent": UA, "Accept-Language": "ar,en;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })
    const body = (await res.text()).slice(0, 60_000)
    if (res.status === 200 && !loginWall.test(body.slice(0, 4000))) {
      return { state: "READY", note: "فحص مباشر: الجلسة تفتح المحتوى الموثق" }
    }
    if (loginWall.test(body.slice(0, 4000))) {
      return { state: "EXPIRED", note: "فحص مباشر: المنصة طلبت تسجيل دخول — الجلسة منتهية على الأغلب" }
    }
    // 3xx لنطاق دخول / صفحات غريبة → نعتبرها انتهاء محتمل بأمان
    return { state: res.status < 400 ? "READY" : "EXPIRED", note: `فحص مباشر: HTTP ${res.status}` }
  } catch (err) {
    // خطأ شبكة/مهلة — ليس دليلًا على انتهاء الجلسة
    return { state: "ERROR", note: `تعذر الفحص (شبكة/مهلة): ${err instanceof Error ? err.message.slice(0, 80) : "خطأ"}` }
  }
}

/** GET: حالة الجلسات لكل المنصات — بدون أي قيم كوكيز */
export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  await ensureSessionTables()
  const rows: Array<{ platform: string; state: string; source: string | null; configured: boolean; lastVerifiedAt: string | null; expiresAt: string | null; lastError: string | null; hint: string | null }> = []
  for (const platform of SESSION_PLATFORMS) {
    const s = await sessionStatusOf(platform)
    rows.push({
      platform,
      state: s.state,
      source: s.source,
      configured: s.state !== "NOT_CONFIGURED",
      lastVerifiedAt: s.lastVerifiedAt?.toISOString() ?? null,
      expiresAt: s.expiresAt?.toISOString() ?? null,
      lastError: s.lastError,
      hint: s.maskedHint, // بصمة مخفية فقط — لا قيمة كوكي
    })
  }
  return json({ sessions: rows })
}

/** POST: إضافة/تحديث جلسة منصة — كوكي واحد كنص (سطر واحد أو JSON كامل) */
export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = await readBody<{ platform?: string; cookie?: string; label?: string; expiresAt?: string; skipVerify?: boolean }>(req)
  const platform = (body?.platform ?? "").toUpperCase()
  const cookie = (body?.cookie ?? "").trim()
  if (!SESSION_PLATFORMS.includes(platform)) return jsonError(`منصة غير مدعومة — المتاح: ${SESSION_PLATFORMS.join("، ")}`)
  if (cookie.length < 20) return jsonError("قيمة الجلسة/الكوكي قصيرة جدًا — انسخ الكوكي كامل")

  await ensureSessionTables()

  // فحص صحة أولي (اختياري تخطّيه للمنصات بدون فحص مخصص)
  let state: SessionState = "READY"
  let note = "محفوظة ومشفّرة — لم تُفحص بعد"
  if (!body?.skipVerify) {
    const hc = await healthCheck(platform, cookie)
    state = hc.state === "ERROR" ? "WARMING" : hc.state
    note = hc.note
  }

  const handle = `${platform.toLowerCase()}-session`
  const existing = await db.platformAccount.findFirst({ where: { workspaceId: auth.workspace.id, platform, handle } })
  const data = {
    kind: "SESSION",
    status: state,
    sessionCipher: encryptSecret(cookie),
    sessionMeta: { note, hint: `${cookie.slice(0, 6)}…`, length: cookie.length } as never,
    lastVerifiedAt: body?.skipVerify ? null : new Date(),
    lastError: state === "EXPIRED" ? note : null,
    ...(body?.expiresAt ? { expiresAt: new Date(body.expiresAt) } : {}),
    ...(body?.label ? { label: body.label } : {}),
  }
  const account = existing
    ? await db.platformAccount.update({ where: { id: existing.id }, data })
    : await db.platformAccount.create({
        data: { workspaceId: auth.workspace.id, platform, handle, ...data },
      })

  // تنبيه بحالة التحوّل + إحياء المهام المنتظرة لهذه المنصة (طلب §18/§26)
  await sessionStateAlert(auth.workspace.id, platform, state, note)
  const requeued = await requeueWaitingJobs(platform)

  return json({
    ok: true,
    platform,
    state,
    note,
    requeuedJobs: requeued,
    // الأمان: لا نرجع الكوكي ولا أي جزء منه
  }, 201)
}

/** PATCH: إعادة فحص صحة جلسة موجودة */
export async function PATCH(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = await readBody<{ platform?: string }>(req)
  const platform = (body?.platform ?? "").toUpperCase()
  if (!SESSION_PLATFORMS.includes(platform)) return jsonError("منصة غير مدعومة")
  const s = await sessionStatusOf(platform)
  if (s.state === "NOT_CONFIGURED" || !s.accountId) return jsonError("لا توجد جلسة لهذه المنصة — أضفها أولًا", 404)
  const acc = await db.platformAccount.findUnique({ where: { id: s.accountId } })
  if (!acc?.sessionCipher) return jsonError("الجلسة المسجلة بلا قيمة مشفرة (من env؟) — الفحص للمحفوظة في قاعدة البيانات فقط", 400)

  const { decryptSecret } = await import("@/lib/capabilities")
  const plain = decryptSecret(acc.sessionCipher)
  if (!plain) return jsonError("تعذر فك تشفير الجلسة (تغيّر AUTH_SECRET؟) — أعد إضافتها", 400)
  const hc = await healthCheck(platform, plain)
  const state: SessionState = hc.state === "ERROR" ? acc.status as SessionState : hc.state
  await db.platformAccount.update({
    where: { id: acc.id },
    data: {
      status: state,
      lastVerifiedAt: new Date(),
      lastError: hc.state === "EXPIRED" ? hc.note : null,
      sessionMeta: { note: hc.note } as never,
    },
  })
  await sessionStateAlert(auth.workspace.id, platform, state, hc.note)
  const requeued = state === "READY" ? await requeueWaitingJobs(platform) : 0
  return json({ ok: true, platform, state, note: hc.note, requeuedJobs: requeued })
}

/** DELETE: حذف جلسة منصة — القدرة تعود تلقائيًا لـ NOT_CONFIGURED */
export async function DELETE(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const platform = (new URL(req.url).searchParams.get("platform") ?? "").toUpperCase()
  if (!SESSION_PLATFORMS.includes(platform)) return jsonError("منصة غير مدعومة")
  const del = await db.platformAccount.deleteMany({
    where: { workspaceId: auth.workspace.id, platform, kind: "SESSION" },
  })
  return json({ ok: true, deleted: del.count, platform, state: "NOT_CONFIGURED" })
}
