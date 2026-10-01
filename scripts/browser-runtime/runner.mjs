#!/usr/bin/env node
// LeadOS — Browser Runtime Runner (طلب §1..§14 + §22 + §23)
// يعمل داخل GitHub Actions Job (وممكن محليًا للتحقق بنفس الكود بالظبط):
//
//   START JOB → START BROWSER → LOAD SESSION → RUN MANY TASKS → KEEP BROWSER ALIVE
//   → RUN NEXT TASK → ... → FINISH JOB → SAVE SESSION STATE → CLOSE BROWSER ONLY AT JOB END
//
// القواعد الصارمة المطبقة هنا:
//   §1  متصفح واحد = منصة واحدة طوال عمر الـJob (السيرفر يمنع خلط المنصات + هنا نصرح بذلك)
//   §2  لا إغلاق للمتصفح بين المهام — مهام كثيرة على متصفح واحد طويل الحياة
//   §9  Rate limiting: وصول للحد → WAIT → RESUME (لا استمرار بعد الحد أبدًا)
//   §10 pacing بشري عشوائي داخل حدود السياسة فقط — لا تلاعب بالتوقيت لتجاوز الحماية
//   §11 فحص صحة الجلسة الدوري — انتهاء الجلسة يوقف المهام الموثقة ويُبقي العامة
//   §12 لا إعادة تشغيل المتصفح بلا سبب — الإغلاق مرة واحدة في نهاية الـJob أو عند فشل قاتل
//   §13 heartbeat كل 30 ثانية
//   §14 checkpoint قبل أي عملية طويلة — فقدان المتصفح لا يعيد المهمة من الصفر
//   §34 لا تجاوز CAPTCHA/MFA/ban — عند الحظر: BACKOFF → تقرير صريح
import { chromium } from "playwright"
import { writeFileSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const BASE = (process.env.LEADOS_BASE_URL || "http://localhost:3000").replace(/\/$/, "")
const SECRET = process.env.LEADOS_RUNNER_SECRET || ""
const PLATFORM_FIXED = (process.env.LEADOS_PLATFORM || "").toUpperCase()
const RUNNER_ID = process.env.LEADOS_RUNNER_ID || `runner-${process.pid}`
const GH_RUN_ID = process.env.GH_RUN_ID || process.env.GITHUB_RUN_ID || null
const GH_REPO = process.env.GITHUB_REPOSITORY || null
const GH_TOKEN = process.env.GITHUB_TOKEN || null
const DISPATCH_EVENT = process.env.LEADOS_DISPATCH_EVENT || "browser-generation"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const now = () => new Date().toISOString().slice(11, 19)
function log(msg) { console.log(`[${now()}] ${msg}`) }

async function api(action, payload = {}) {
  const res = await fetch(`${BASE}/api/browser/generation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": SECRET },
    body: JSON.stringify({ action, ghRunId: GH_RUN_ID, runnerId: RUNNER_ID, ...payload }),
    signal: AbortSignal.timeout(60_000),
  })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: { raw: text.slice(0, 200) } } }
}

/** نافذة الإجراءات (§9): عدّاد زمني منزلق — عند الحد: WAIT ثم RESUME */
class ActionWindow {
  constructor(maxActions, windowMs) { this.max = maxActions; this.windowMs = windowMs; this.ticks = [] }
  async before(browserId, currentTask) {
    const t = Date.now()
    this.ticks = this.ticks.filter((x) => t - x < this.windowMs)
    if (this.ticks.length >= this.max) {
      const waitMs = Math.min(this.windowMs - (t - this.ticks[0]) + 1000, 180_000)
      log(`⏳ RATE_LIMIT وصلنا حد السياسة (${this.max} إجراء/${Math.round(this.windowMs / 60000)}د) → WAIT ${Math.round(waitMs / 1000)}s ثم RESUME`)
      await api("heartbeat", { browserId, currentTask, rateWait: { waitedMs: waitMs, windowActions: this.ticks.length } })
      await sleep(waitMs)
      const t2 = Date.now()
      this.ticks = this.ticks.filter((x) => t2 - x < this.windowMs)
    }
    this.ticks.push(Date.now())
  }
}

/** كشف جدار تسجيل الدخول — وجوده = الجلسة انتهت (لا تجاوز أبدًا §34) */
function looksLoggedOut(text) {
  return /تسجيل الدخول|log in to (facebook|continue)|login_form|checkpoint|please log in|sign in to continue/i.test((text || "").slice(0, 4000))
}

/** استخراج منشورات من صفحة جروب (mbasic/ويب) — قارئ عام محايد بدون أي تجاوز */
function extractPostsFromPage() {
  const nodes = document.querySelectorAll("div[data-ft], article, div[role='article'], div.c")
  const out = []
  for (const el of Array.from(nodes).slice(0, 30)) {
    const text = (el.innerText || el.textContent || "").trim()
    if (text.length < 40) continue
    const linkEl = el.querySelector("a[href*='/permalink.php'], a[href*='/posts/'], a[href*='/comments/'], a[href*='/r/'], a[href*='status']")
    out.push({
      text: text.slice(0, 900),
      permalink: linkEl ? linkEl.href : null,
      author: null,
    })
  }
  return out
}

async function main() {
  log(`🚀 Browser Runtime — runner=${RUNNER_ID} ghRun=${GH_RUN_ID ?? "local"} base=${BASE}`)
  // ═══ 1) START: درع الامتثال + استعادة الجلسة + claim جوبات المنصة ═══
  const start = await api("start", PLATFORM_FIXED ? { platform: PLATFORM_FIXED } : {})
  const sb = start.body
  if (!sb?.ok) {
    log(`⏸️ لا جيل جديد: decision=${sb?.decision} reason=${sb?.reason ?? "-"} — ${sb?.note ?? ""}`)
    log("   (لا dispatch — لا جيل جديد قبل الحاجة الفعلية §23)")
    process.exit(0)
  }
  const { platform, generation, browserId, profileId, policy, jobs, session } = sb
  log(`✅ ALLOW ${platform} g${generation} browser=${browserId} profile=${profileId}`)
  log(`   جلسة: status=${session.status} v${session.version} (persistent session state — لا جلسة جديدة بلا سبب)`)
  log(`   مهام: ${jobs.length} على ${platform} — متصفح واحد طويل الحياة بلا إغلاق بينها (§2)`)
  jobs.forEach((j, i) => log(`   • #${i + 1} ${j.task} job=${j.id}${j.checkpoint ? ` ⏩ استكمال من checkpoint: ${j.checkpoint.step}` : ""}`))

  // ═══ 2) START BROWSER (مرة واحدة) + LOAD SESSION ═══
  const browser = await chromium.launch({ headless: true })
  let context
  try {
    if (session.storage) {
      const st = JSON.parse(session.storage)
      if (st.seed && st.cookieHeader) {
        // بذرة من جلسة المنصة الموجودة (PlatformAccount) → كوكيز حقيقية داخل المتصفح
        const cookies = st.cookieHeader.split(/;\s*/).map((pair) => {
          const eq = pair.indexOf("=")
          if (eq < 1) return null
          return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), domain: st.cookieDomain, path: "/" }
        }).filter(Boolean)
        context = await browser.newContext({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36" })
        await context.addCookies(cookies)
        log(`   📥 الجلسة مبنية من كوكيز المنصة الموجودة (${cookies.length} كوكي) — نفس الجلسة المستمرة`)
      } else {
        // storage state كامل من الجيل السابق → استعادة حرفية (§24)
        const dir = mkdtempSync(join(tmpdir(), "leados-rt-"))
        const f = join(dir, "storage-state.json")
        writeFileSync(f, JSON.stringify(st))
        context = await browser.newContext({ storageState: f })
        log(`   📥 storage state مستعاد من الجيل السابق (v${session.version})`)
      }
    } else {
      context = await browser.newContext()
      log("   ⚠️ لا جلسة محفوظة — متصفح عام (المهام العامة فقط)")
    }
  } catch (err) {
    log(`💥 فشل بناء السياق: ${err.message} → finish SESSION_CORRUPTION`)
    await api("finish", { browserId, closeReason: "SESSION_CORRUPTION", note: `فشل استعادة الجلسة: ${String(err.message).slice(0, 150)}` })
    process.exit(1)
  }

  const page = await context.newPage()
  const window = new ActionWindow(policy.maxActionsPerWindow, policy.windowMs)
  let sessionHealth = session.status === "NEEDS_SESSION" ? "NEEDS_SESSION" : "HEALTHY"
  let lastHealthCheck = Date.now()
  let rateWaitReport = null

  // ═══ 3) HEARTBEAT (§13) — كل 30 ثانية طوال حياة المتصفح ═══
  let currentTaskLabel = "بداية الجيل"
  const hb = setInterval(async () => {
    api("heartbeat", { browserId, currentTask: currentTaskLabel, rateWait: rateWaitReport }).catch(() => {})
    rateWaitReport = null
  }, 30_000)

  const checkSessionHealth = async () => {
    if (Date.now() - lastHealthCheck < policy.sessionHealthIntervalMs) return
    lastHealthCheck = Date.now()
    const homes = { FACEBOOK: "https://mbasic.facebook.com/", INSTAGRAM: "https://www.instagram.com/", LINKEDIN: "https://www.linkedin.com/feed/", X: "https://x.com/home", TIKTOK: "https://www.tiktok.com/", REDDIT: "https://www.reddit.com/" }
    const home = homes[platform]
    if (!home) return
    try {
      await window.before(browserId, "فحص صحة الجلسة الدوري")
      const res = await page.goto(home, { waitUntil: "domcontentloaded", timeout: 45_000 })
      const text = await page.content()
      if (res && res.status() < 400 && !looksLoggedOut(text)) {
        sessionHealth = "HEALTHY"
        log(`💚 فحص الجلسة: HEALTHY (${platform})`)
      } else {
        sessionHealth = "EXPIRED"
        log(`🛑 فحص الجلسة: EXPIRED — إيقاف المهام الموثقة، استمرار العامة (§11)`)
      }
    } catch { /* شبكة — لا نقلّع الجلسة على عتاب شبكة */ }
  }

  // ═══ 4) RUN MANY TASKS — لا إغلاق ولا إعادة تشغيل بينها (§2/§12) ═══
  let done = 0
  let failed = 0
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]
    const needsSession = Boolean(job.payload.sessionRequired) || job.task === "GROUPS_SCAN" || job.task === "RADAR_SCAN"
    if (needsSession && sessionHealth === "EXPIRED") {
      log(`⏭️ #${i + 1} ${job.task} تُخطى — الجلسة منتهية والمهمة موثقة (§11)`)
      await api("task", { browserId, jobId: job.id, ok: false, note: "SESSION_EXPIRED — مؤجلة حتى استعادة الجلسة" })
      continue
    }

    currentTaskLabel = `${job.task} #${i + 1}/${jobs.length}`
    // CHECKPOINT قبل العملية الطويلة (§14)
    await api("checkpoint", { browserId, jobId: job.id, step: `task:${i + 1}`, cursor: { groupIndex: i, groupExternalId: job.payload.groupExternalId ?? null } }).catch(() => {})

    try {
      await window.before(browserId, currentTaskLabel)
      let ok = false
      let note = ""
      const data = {}

      if (job.task === "GROUPS_SCAN" || job.task === "RADAR_SCAN") {
        let url = String(job.payload.groupUrl || "")
        if (platform === "FACEBOOK") url = url.replace("//www.facebook.com", "//mbasic.facebook.com").replace("//web.facebook.com", "//mbasic.facebook.com")
        if (!url) throw new Error("لا url للجروب")
        const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 })
        await sleep(1200 + Math.floor(Math.random() * 2000)) // §10: pacing بشري داخل الحدود
        const html = await page.content()
        if (looksLoggedOut(html)) {
          sessionHealth = "EXPIRED"
          if (needsSession) {
            await api("task", { browserId, jobId: job.id, ok: false, note: "NEEDS_SESSION — المنصة طلبت تسجيل دخول", data: { status: "NEEDS_SESSION", sessionHealth } })
            log(`🛑 #${i + 1} جدار دخول → NEEDS_SESSION (لا تجاوز §34)`)
            continue
          }
        }
        if (res && res.status() >= 400 && res.status() !== 404) throw new Error(`HTTP ${res.status()}`)
        if (/محتوى غير متوفر|content isn't available|هذا المحتوى غير متاح/i.test(html.slice(0, 6000))) {
          ok = true; note = "BLOCKED — الجروب خاص/محتواه غير متاح"; data.status = "BLOCKED"
        } else {
          const raw = await page.evaluate(extractPostsFromPage)
          const posts = raw.filter((p) => p.text && p.text.length >= 40).slice(0, 15).map((p) => ({
            externalId: p.permalink ? `bp:${p.permalink.split("?")[0].slice(-60)}` : `bt:${p.text.slice(0, 60)}`,
            url: p.permalink || url, author: p.author, content: p.text, postedAt: null,
          }))
          ok = true
          data.posts = posts
          data.status = "OK"
          note = `${posts.length} منشور مستخرج`
        }
      } else if (job.task === "PUBLIC_FETCH") {
        const url = String(job.payload.url || "")
        if (!url) throw new Error("لا url")
        const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 })
        await sleep(800 + Math.floor(Math.random() * 1200))
        const html = await page.content()
        if (looksLoggedOut(html)) {
          ok = false; note = "NEEDS_SESSION — صفحة خلف جدار دخول (Jina قد يقرأها كعامة لاحقًا)"
        } else {
          const text = await page.evaluate(() => (document.body?.innerText || "").slice(0, 20_000))
          ok = text.trim().length >= 200
          data.text = text
          data.via = "browser"
          note = ok ? `${text.length} حرف` : "محتوى غير كافٍ"
          if (!ok) note += " — fallback Jina ممكن عبر القارئ الموحد لاحقًا (§28)"
        }
      } else {
        ok = false
        note = `مهمة غير معروفة للـrunner: ${job.task}`
      }

      await api("task", { browserId, jobId: job.id, ok, note, data })
      if (ok) { done++; log(`✅ #${i + 1} ${job.task} — ${note}`) }
      else { failed++; log(`⚠️ #${i + 1} ${job.task} — ${note}`) }
    } catch (err) {
      const msg = String(err?.message || err).slice(0, 200)
      failed++
      log(`❌ #${i + 1} ${job.task} فشلت: ${msg}`)
      // فشل قاتل للمتصفح؟ (§12: crash/fatal فقط تبرر إعادة تشغيل) — تقرير وإنهاء؛ الباقي يكمل
      if (/Target closed|Browser closed|Session closed|has been closed|ECONNRESET/i.test(msg)) {
        await api("task", { browserId, jobId: job.id, ok: false, note: `BROWSER_CRASH: ${msg}` })
        log(`💥 المتصفح حصل crash — finish(CRASH) + checkpoint محفوظ مسبقًا → الجيل القادم يستكمل (§14/§25)`)
        clearInterval(hb)
        await api("finish", { browserId, closeReason: "CRASH", sessionHealth, note: msg })
        process.exit(1)
      }
      await api("task", { browserId, jobId: job.id, ok: false, note: msg }).catch(() => {})
    }

    await checkSessionHealth()
    // pacing بين المهام (داخل حدود السياسة — §10)
    const gap = policy.minDelayMs + Math.floor(Math.random() * Math.max(1, policy.maxDelayMs - policy.minDelayMs))
    await sleep(gap)
  }

  // ═══ 5) FINISH JOB → SAVE SESSION STATE → CLOSE BROWSER (مرة واحدة فقط) ═══
  clearInterval(hb)
  let storageState = null
  let cookieCount = null
  try {
    const st = await context.storageState()
    storageState = JSON.stringify(st)
    cookieCount = st.cookies.length
    log(`💾 session state محفوظ (${cookieCount} كوكي) — الجيل القادم يستعيده (§3/§4)`)
  } catch (err) {
    log(`⚠️ تعذر تصدير storage state: ${String(err.message).slice(0, 100)}`)
  }
  await page.close().catch(() => {})
  await context.close().catch(() => {})
  await browser.close().catch(() => {})
  log(`🔒 المتصفح أُغلق مرة واحدة في نهاية الـJob (§2) — tasks: ${done} ناجحة / ${failed} فاشلة`)

  const fin = await api("finish", {
    browserId, closeReason: "JOB_END", storageState, sessionHealth, cookieCount,
    note: `tasks done=${done} failed=${failed}`,
  })
  const d = fin.body?.dispatch
  if (d) {
    log(`🔗 Generation handoff: g${generation} → g${d.nextGeneration} parentRun=${d.parentRunId} childRun=${d.childRunId} queue=${d.queueDepth}`)
    if (d.shouldDispatch && GH_TOKEN && GH_REPO) {
      const dispatches = 1 + (d.additionalDispatches || 0)
      for (let k = 0; k < dispatches; k++) {
        try {
          const res = await fetch(`https://api.github.com/repos/${GH_REPO}/dispatches`, {
            method: "POST",
            headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "leados-browser-runtime" },
            body: JSON.stringify({ event_type: DISPATCH_EVENT, client_payload: { platform: d.platform, generation: d.nextGeneration, childRunId: d.childRunId, slot: k } }),
          })
          log(k === 0 ? `📤 self-dispatch: repository_dispatch (${d.platform} g${d.nextGeneration}) → HTTP ${res.status}` : `📤 dispatch إضافي للسعة #${k} → HTTP ${res.status}`)
        } catch (err) {
          log(`⚠️ dispatch فشل: ${String(err.message).slice(0, 120)} — النبضة الدورية ستلتقط الشغل`)
        }
        if (k < dispatches - 1) await sleep(d.delayMs || 120_000)
      }
    } else if (d.shouldDispatch) {
      log(`ℹ️ dispatch مطلوب (${d.platform} g${d.nextGeneration} بعد ${Math.round(d.delayMs / 1000)}s) — بلا GITHUB_TOKEN هنا: النبضة الدورية/الجدولة ستلتقطه`)
    } else {
      log(`ℹ️ لا dispatch: ${d.queueDepth > 0 ? "cooldown نشط" : "لا شغل مستحق"}`)
    }
  }
  log(`🏁 الجيل ${generation} اكتمل على ${platform}`)
  process.exit(failed > 0 && done === 0 ? 1 : 0)
}

main().catch(async (err) => {
  log(`💀 runner fatal: ${String(err?.stack || err).slice(0, 400)}`)
  process.exit(1)
})
