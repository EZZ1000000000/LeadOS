// تشخيص بجلسة الإنتاج: هل الجلسة تمنع تحويل mbasic→login؟ (نفس بروتوكول الـrunner)
import { chromium } from "playwright"
import { writeFileSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const BASE = "https://leados-olive.vercel.app"
const SECRET = process.env.LEADOS_RUNNER_SECRET
const GROUP = process.argv[2] || "https://mbasic.facebook.com/groups/224619592515112"

async function api(action, payload = {}) {
  const res = await fetch(`${BASE}/api/browser/generation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": SECRET },
    body: JSON.stringify({ action, runnerId: "diag-session", ...payload }),
  })
  return res.json()
}

const start = await api("start", { platform: "FACEBOOK" })
if (!start.ok) { console.log("start refused:", start.decision, start.reason, start.note); process.exit(0) }
console.log("browser:", start.browserId, "gen:", start.generation, "session:", start.session.status, "v", start.session.version)

const browser = await chromium.launch({ headless: true })
let context
const st = JSON.parse(start.session.storage)
if (st.seed && st.cookieHeader) {
  const cookies = st.cookieHeader.split(/;\s*/).map((pair) => {
    const eq = pair.indexOf("=")
    if (eq < 1) return null
    return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), domain: st.cookieDomain || ".facebook.com", path: "/" }
  }).filter(Boolean)
  context = await browser.newContext({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36" })
  await context.addCookies(cookies)
  console.log("cookies injected:", cookies.length)
} else {
  const dir = mkdtempSync(join(tmpdir(), "diag-"))
  const f = join(dir, "ss.json")
  writeFileSync(f, JSON.stringify(st))
  context = await browser.newContext({ storageState: f })
  console.log("full storage state restored")
}
const page = await context.newPage()
const res = await page.goto(GROUP, { waitUntil: "domcontentloaded", timeout: 60_000 })
console.log("final URL:", page.url().slice(0, 90))
console.log("status:", res?.status())
await page.waitForTimeout(2500)
const counts = {
  "div[data-ft]": await page.locator("div[data-ft]").count(),
  "div.c": await page.locator("div.c").count(),
  "[role='article']": await page.locator("[role='article']").count(),
  "a[href*='permalink']": await page.locator("a[href*='permalink']").count(),
}
console.log("selectors:", JSON.stringify(counts))
const text = await page.evaluate(() => (document.body?.innerText || "").slice(0, 400))
console.log("=== body sample ===")
console.log(text)
// حفظ storage state للفحص (عدد الكوكيز فقط)
const ss = await context.storageState()
console.log("context cookies:", ss.cookies.length, "— origins:", ss.origins.length)
await browser.close()
await api("finish", { browserId: start.browserId, closeReason: "JOB_END", note: "diag done", sessionHealth: "HEALTHY" })
console.log("runtime closed")
