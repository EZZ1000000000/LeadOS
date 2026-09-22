// LeadOS — Stealth Browser Client (Camoufox)
// عميل Next.js لخدمة المتصفح المضاد للبصمة (scripts/camoufox-service.py).
// - لو الخدمة مش شغالة: بيحاول يشغّلها تلقائيًا (تطوير/سيرفر ذاتي فقط — مش على Vercel).
// - لو فشل كل شيء: يرجع نتيجة واضحة graceful بدون ما يكسر أي مسار.
// على Vercel: اضبط CAMOUFOX_URL على خادم خارجي يشغّل الخدمة (Docker/VPS).
import { spawn } from "node:child_process"
import { appendFileSync, existsSync, openSync } from "node:fs"
import path from "node:path"

const BASE = (process.env.CAMOUFOX_URL || "http://127.0.0.1:9797").replace(/\/$/, "")
const TOKEN = process.env.CAMOUFOX_TOKEN

export interface StealthHealth {
  online: boolean
  browser: "running" | "booting" | "idle" | string
  pages?: number
  error?: string
}

export interface StealthNav {
  ok: boolean
  url?: string
  http_status?: number | null
  title?: string
  text?: string
  screenshot?: string | null
  error?: string
}

function headers(): Record<string, string> {
  return { "Content-Type": "application/json", ...(TOKEN ? { "x-leados-token": TOKEN } : {}) }
}

async function post<T>(endpoint: string, body: unknown, timeoutMs = 300_000): Promise<T> {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const data = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
  return data
}

export async function stealthHealth(timeoutMs = 4000): Promise<StealthHealth> {
  try {
    const res = await fetch(`${BASE}/health`, {
      headers: headers(),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const data = (await res.json()) as StealthHealth
    return { ...data, online: res.ok }
  } catch (err) {
    return { online: false, browser: "offline", error: err instanceof Error ? err.message : "offline" }
  }
}

// ═══════════ التشغيل التلقائي للخدمة (dev/self-host) ═══════════

let ensurePromise: Promise<boolean> | null = null
let lastSpawnAttempt = 0

function log(msg: string) {
  try {
    appendFileSync("/tmp/camoufox.log", `[spawn] ${msg}\n`)
  } catch {
    /* ignore */
  }
}

function spawnSidecar(): boolean {
  if (process.env.VERCEL === "1") return false // سيرفرليس — لا عمليات خلفية
  if (Date.now() - lastSpawnAttempt < 30_000) return false // امنع فوضى الإطلاق
  lastSpawnAttempt = Date.now()
  const script = path.join(process.cwd(), "scripts", "camoufox-service.py")
  if (!existsSync(script)) {
    log(`script غير موجود: ${script}`)
    return false
  }
  const candidates = [process.env.CAMOUFOX_PYTHON, "python3", "python", "/home/z/.venv/bin/python3"].filter(
    Boolean,
  ) as string[]
  for (const py of candidates) {
    try {
      const out = openSync(path.join(process.env.TEMP || "/tmp", "camoufox.log"), "a")
      const child = spawn(py, [script], { detached: true, stdio: ["ignore", out, out], env: process.env })
      child.unref()
      log(`تم الإطلاق عبر ${py} (pid ${child.pid})`)
      return true
    } catch (err) {
      log(`فشل ${py}: ${err instanceof Error ? err.message : "?"}`)
    }
  }
  return false
}

/** يضمن وجود خدمة المتصفح — يشغّلها تلقائيًا لو معطلة وينتظر جهوزيتها */
export async function ensureStealth(maxWaitMs = 90_000): Promise<boolean> {
  const quick = await stealthHealth()
  if (quick.online) return true
  if (!ensurePromise) {
    ensurePromise = (async () => {
      if (!spawnSidecar()) return false
      const deadline = Date.now() + maxWaitMs
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000))
        const h = await stealthHealth()
        if (h.online) return true
      }
      return false
    })().finally(() => {
      ensurePromise = null
    })
  }
  return ensurePromise
}

// ═══════════ العمليات عالية المستوى ═══════════

export interface NavOptions {
  url: string
  wait_until?: "domcontentloaded" | "load" | "networkidle"
  timeout?: number
  screenshot?: boolean
  full_page?: boolean
  scroll_times?: number
  session?: string
}

/** تصفح صفحة وإرجاع النص الكامل + اختياري سكرين شوت */
export async function stealthNavigate(opts: NavOptions): Promise<StealthNav> {
  if (!(await ensureStealth())) {
    return { ok: false, error: "STEALTH_UNAVAILABLE — خدمة Camoufox غير متاحة (اضبط CAMOUFOX_URL على خادم خارجي على Vercel)" }
  }
  try {
    return await post<StealthNav>("/navigate", opts, (opts.timeout ?? 45_000) + 60_000)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "فشل التصفح" }
  }
}

export interface ExtractResult {
  ok: boolean
  count?: number
  items?: string[]
  error?: string
}

/** استخراج نصوص/خصائص عناصر من الصفحة الحالية في الجلسة */
export async function stealthExtract(opts: {
  selector: string
  attr?: string
  limit?: number
  session?: string
}): Promise<ExtractResult> {
  try {
    return await post<ExtractResult>("/extract", opts)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "فشل الاستخراج" }
  }
}

export interface ActResult {
  ok: boolean
  note?: string
  result?: unknown
  screenshot?: string | null
  error?: string
}

/** تفاعل: click / type / press / scroll / wait / eval / screenshot */
export async function stealthAct(opts: {
  action: string
  selector?: string
  text?: string
  key?: string
  script?: string
  amount?: number
  timeout?: number
  session?: string
}): Promise<ActResult> {
  try {
    return await post<ActResult>("/act", opts, 120_000)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "فشل التنفيذ" }
  }
}

/** حقن كوكيز جلسة (نص هيدر Cookie) في بروفايل المتصفح — يخلي الأيجنت "مسجل دخول" */
export async function stealthInjectCookieHeader(
  cookieHeader: string,
  domain = ".facebook.com",
): Promise<boolean> {
  const cookies = cookieHeader
    .split(/;\s*/)
    .map((pair) => {
      const eq = pair.indexOf("=")
      if (eq < 1) return null
      return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), domain, path: "/" }
    })
    .filter((c): c is { name: string; value: string; domain: string; path: string } => Boolean(c))
  if (!cookies.length) return false
  try {
    const r = await post<{ ok: boolean; added: number }>("/cookies", { cookies }, 30_000)
    return r.ok
  } catch {
    return false
  }
}

/** حالة مختصرة للواجهات: الخدمة + المتصفح */
export async function stealthStatus() {
  const h = await stealthHealth()
  return {
    service: h.online,
    browser: h.browser,
    pages: h.pages ?? 0,
    url: BASE,
    note: h.online
      ? h.browser === "running"
        ? "المتصفح الستيلث جاهز"
        : "الخدمة شغالة — المتصفح هيتفعل عند أول استخدام"
      : "خدمة Camoufox غير متاحة",
  }
}
