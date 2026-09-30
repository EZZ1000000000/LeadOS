// LeadOS — Platform Capability Matrix API (SESSIONLESS MODE)
// المصدر الوحيد لعرض القدرات على اللوحة — بدون أي قيم سرية أبدًا
import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { capabilityMatrix, currentRuntimeMode, ensureSessionTables, setGlobalStop, RUNTIME_MODES_SET } from "@/lib/capabilities"

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  // ضمان الجداول عند أول فتح للوحة (بعد نجاح المصادقة — آمن)
  const tables = await ensureSessionTables()
  const [{ mode, reason, rows }, waitingJobs] = await Promise.all([
    capabilityMatrix(),
    db.job.count({ where: { status: "WAITING_FOR_CAPABILITY" } }).catch(() => 0),
  ])
  return json({
    mode,
    reason,
    tablesEnsured: tables.ensured,
    waitingJobs,
    rows,
    summary: {
      ready: rows.filter((r) => r.currentCapability === "READY").length,
      publicOnly: rows.filter((r) => r.currentCapability === "PUBLIC_ONLY").length,
      needsSession: rows.filter((r) => r.currentCapability === "NEEDS_SESSION").length,
      errors: rows.filter((r) => r.currentCapability === "ERROR").length,
    },
  })
}

/** تغيير وضع التشغيل يدويًا (مفتاح الإيقاف العام STOPPED / رجوع تلقائي) */
export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  if (auth.user.role !== "OWNER" && auth.user.role !== "ADMIN") return jsonError("الوضع لـ Owner/Admin فقط", 403)
  const body = await readBody<{ mode?: string }>(req)
  const mode = (body?.mode ?? "").toUpperCase()
  if (!RUNTIME_MODES_SET.has(mode)) return jsonError(`الوضع غير معروف — المتاح: ${[...RUNTIME_MODES_SET].join("، ")}`)
  try {
    await ensureSessionTables()
    if (mode === "STOPPED") {
      await setGlobalStop(true, auth.user.email || auth.user.id)
    } else {
      // FULL/SESSIONLESS/DEGRADED = كلها رجوع للحساب التلقائي + رفع أي قفل إيقاف
      await setGlobalStop(false, auth.user.email || auth.user.id)
    }
  } catch (err) {
    return jsonError(`تعذر حفظ الوضع: ${err instanceof Error ? err.message.slice(0, 120) : "خطأ"}`, 500)
  }
  const { mode: effective, reason } = await currentRuntimeMode()
  return json({ ok: true, requested: mode, mode: effective, reason })
}
