// LeadOS Browser Runtime — Test lib (bun)
// كل الاختبارات تنفذ الحلقة الحقيقية: API محلي + runner حقيقي بمتصفح Playwright حقيقي
import { PrismaClient } from "@prisma/client"
import { spawn } from "child_process"
import { readFileSync, appendFileSync, existsSync } from "fs"

export const db = new PrismaClient()
export const API = process.env.TEST_API || "http://localhost:3000"
export const SECRET = (() => {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^CRON_SECRET=(.*)$/)
    if (m) return m[1].trim()
  }
  return ""
})()
export const EVIDENCE = "scripts/hardtest-browser/evidence.md"

export function log(msg: string) {
  console.log(msg)
  if (!existsSync(EVIDENCE)) appendFileSync(EVIDENCE, "# Browser Runtime — أدلة الاختبار الحقيقي\n\n")
  // الأدلة تُلحق فقط عند الاستدعاء الصريح record()
}
export function record(section: string, text: string) {
  appendFileSync(EVIDENCE, `### ${section}\n${text}\n\n`)
  console.log(`  📋 evidence → ${section}`)
}

export function ok(name: string, cond: boolean, detail = ""): boolean {
  const mark = cond ? "✅" : "❌"
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`)
  record(`تحقّق: ${name}`, `${cond ? "PASS" : "FAIL"} — ${detail}`)
  return cond
}

/** تشغيل الـrunner الحقيقي (Playwright) كعملية مستقلة */
export function runner(platform?: string, timeoutMs = 300_000): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn("node", ["scripts/browser-runtime/runner.mjs"], {
      env: {
        ...process.env,
        LEADOS_BASE_URL: API,
        LEADOS_RUNNER_SECRET: SECRET,
        ...(platform ? { LEADOS_PLATFORM: platform } : {}),
        LEADOS_RUNNER_ID: `test-runner-${Date.now().toString(36)}`,
      },
      cwd: process.cwd(),
    })
    let out = ""
    child.stdout.on("data", (d) => { out += d.toString(); process.stdout.write(d.toString()) })
    child.stderr.on("data", (d) => { out += d.toString(); process.stdout.write(d.toString()) })
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs)
    child.on("close", (code) => { clearTimeout(timer); resolve({ code: code ?? -1, out }) })
  })
}

export async function api(action: string, payload: Record<string, unknown> = {}) {
  const res = await fetch(`${API}/api/browser/generation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": SECRET },
    body: JSON.stringify({ action, ...payload }),
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

/** بذر جوبات BROWSER_SCAN مباشرة (بيانات اختبار) */
export async function seedJobs(
  workspaceId: string, platform: string, task: string,
  jobs: Array<{ url?: string; groupId?: string; groupUrl?: string; groupName?: string; sessionRequired?: boolean }>,
) {
  const created = []
  for (const j of jobs) {
    const job = await db.job.create({
      data: {
        workspaceId, type: "BROWSER_SCAN", priority: 60,
        payload: { platform, task, url: j.url, groupId: j.groupId, groupUrl: j.groupUrl, groupName: j.groupName, groupExternalId: j.groupId, sessionRequired: j.sessionRequired ?? false, seededBy: "hardtest-browser" } as never,
      },
    })
    created.push(job)
  }
  return created
}

export async function workspaceId(): Promise<string> {
  const ws = await db.workspace.findFirst()
  return ws!.id
}

/** patch مؤقت لسياسة (للاختبار فقط) — يعيد القيمة الأصلية بنفسه */
export async function withPolicyOverride<T>(platform: string, field: string, value: number, fn: () => Promise<T>): Promise<T> {
  const file = `src/config/platform-policies/${platform.toLowerCase()}.ts`
  const orig = readFileSync(file, "utf8")
  const re = new RegExp(`("?${field}"?: )\\d+`)
  if (!re.test(orig)) throw new Error(`field ${field} غير موجود في ${file}`)
  writePolicy(file, orig.replace(re, `$1${value}`))
  try {
    await new Promise((r) => setTimeout(r, 1500)) // hot reload
    return await fn()
  } finally {
    writePolicy(file, orig)
  }
}

/** ساعات اختبار 0-24 (الاختبارات تجري ليلًا بتوقيت القاهرة) — تُعاد السياسة كما كانت */
export async function withNightHours<T>(platform: string, fn: () => Promise<T>): Promise<T> {
  const file = `src/config/platform-policies/${platform.toLowerCase()}.ts`
  const orig = readFileSync(file, "utf8")
  const patched = orig.replace(/"start": \d+/, '"start": 0').replace(/"end": \d+/, '"end": 24')
  writePolicy(file, patched)
  try {
    await new Promise((r) => setTimeout(r, 1500))
    return await fn()
  } finally {
    writePolicy(file, orig)
  }
}
function writePolicy(file: string, content: string) {
  // fs sync write — استيراد مباشر
  const fs = require("fs")
  fs.writeFileSync(file, content)
}

/** دخول كمدير — يرجع كوكي الجلسة للوحة */
export async function adminCookie(): Promise<string> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@leados.com", password: "admin123" }),
  })
  const setCookie = res.headers.get("set-cookie") ?? ""
  return setCookie.split(";")[0]
}

export async function controlData(cookie: string) {
  const res = await fetch(`${API}/api/browser/control`, { headers: { cookie } })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}
