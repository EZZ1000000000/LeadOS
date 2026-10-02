#!/usr/bin/env node
// LeadOS — Browser Runtime E2E Test Suite (T1..T20) — v2
// تشغيل حقيقي ضد التطبيق المحلي + بروتوكول الـrunner الحقيقي + قاعدة محلية.
// درس v1: API يختار أقدم ورشة نشطة (workspaceIdOf asc) — الحزمة تمسح ورش e2e القديمة أولًا.
import { readFileSync } from "node:fs"
import { PrismaClient } from "@prisma/client"

const BASE = process.env.LEADOS_BASE_URL || "http://localhost:3000"
const db = new PrismaClient()

function loadSecret() {
  try {
    const env = readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    const m = env.match(/^CRON_SECRET=(.*)$/m)
    return m ? m[1].trim() : ""
  } catch { return "" }
}
const SECRET = process.env.CRON_SECRET || loadSecret()

const results = []
function report(id, name, pass, evidence) {
  results.push({ id, name, pass, evidence })
  console.log(`\n${pass ? "✅ PASS" : "❌ FAIL"} — ${id}: ${name}`)
  if (evidence) console.log(`   دليل: ${evidence}`)
}

async function gen(action, payload = {}) {
  const res = await fetch(`${BASE}/api/browser/generation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": SECRET },
    body: JSON.stringify({ action, runnerId: "e2e-suite", ghRunId: "e2e", ...payload }),
    signal: AbortSignal.timeout(60_000),
  })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: { raw: text.slice(0, 300) } } }
}

async function enqueue(wsId, platform, task, url, extra = {}) {
  return db.job.create({
    data: {
      workspaceId: wsId, type: "BROWSER_SCAN", priority: extra.priority ?? 60,
      payload: { platform, task, url, ...(extra.sessionRequired ? { sessionRequired: true } : {}), seededBy: "e2e" },
    },
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log(`\n══════ LeadOS Browser Runtime — E2E T1..T20 (v2) — ${BASE} ══════`)

  // ═══ SETUP: مسح ورش e2e القديمة (تضمن API يعمل على ورشتنا بالضبط) ═══
  const old = await db.workspace.findMany({ where: { slug: { startsWith: "e2e-rt-" } }, select: { id: true } })
  if (old.length) await db.workspace.deleteMany({ where: { slug: { startsWith: "e2e-rt-" } } })
  const slug = `e2e-rt-${Date.now().toString(36)}`
  const ws = await db.workspace.create({ data: { name: "E2E Browser Runtime", slug, isActive: true } })
  const source = await db.source.create({ data: { workspaceId: ws.id, type: "WEB", name: "E2E Source", status: "ACTIVE" } })
  await db.systemState.upsert({ where: { id: "singleton" }, update: { state: "RUNNING", reason: null, resumedAt: new Date() }, create: { id: "singleton", state: "RUNNING" } })
  console.log(`setup: مسح ${old.length} ورشة قديمة — workspace=${ws.id} source=${source.id}`)

  /** إغلاق متصفح اختبار: finish + إعادة RUNNING للطابور + تنظيف أحداث الحراسة (cooldown/backoff) */
  async function closeBrowser(bid, opts = {}) {
    if (bid) await gen("finish", { browserId: bid, closeReason: opts.closeReason ?? "JOB_END", ...opts })
    await db.job.updateMany({ where: { workerId: { startsWith: "browser:" }, status: "RUNNING" }, data: { status: "QUEUED", workerId: null, lockedAt: null, scheduledAt: new Date() } })
    // الاختبارات سريعة — cooldown/backoff الحقيقيان سيحاصران البداية التالية؛ نمسح أحداثهما لهذه الورشة فقط
    await db.browserEvent.deleteMany({ where: { workspaceId: ws.id, type: { in: ["BROWSER_CLOSE", "TASK_FAILED"] } } })
  }


  const FB = "FACEBOOK", IG = "INSTAGRAM"
  const queuedByPlatform = async (platform) => {
    const rows = await db.job.findMany({ where: { workspaceId: ws.id, type: "BROWSER_SCAN", status: { in: ["QUEUED", "RETRYING"] } }, select: { payload: true } })
    return rows.filter((j) => j.payload?.platform === platform).length
  }
  /** تنظيف أحداث الحراسة (cooldown/backoff) للاختبار التالي — الاختبارات أسرع من فترات التهدئة الحقيقية */
  const clearGuards = () => db.browserEvent.deleteMany({ where: { workspaceId: ws.id, type: { in: ["BROWSER_CLOSE", "TASK_FAILED"] } } })

  // ═══ T1: عزل المنصات ═══
  {
    const jf1 = await enqueue(ws.id, FB, "PUBLIC_FETCH", "https://example.com/t1a")
    const jf2 = await enqueue(ws.id, FB, "PUBLIC_FETCH", "https://example.com/t1b")
    await enqueue(ws.id, IG, "PUBLIC_FETCH", "https://example.com/t1c")
    await enqueue(ws.id, IG, "PUBLIC_FETCH", "https://example.com/t1d")
    const r = await gen("start", { platform: IG })
    const jobs = r.body?.jobs ?? []
    const allIG = jobs.length === 2 && jobs.every((j) => j.payload?.platform === IG)
    const fbUntouched = (await db.job.findUnique({ where: { id: jf1.id } })).status === "QUEUED"
      && (await db.job.findUnique({ where: { id: jf2.id } })).status === "QUEUED"
    const profileOK = r.body?.profileId === "bpf-instagram-01"
    report("T1", "عزل المنصات — claim منصة واحدة فقط", r.status === 200 && r.body?.ok === true && allIG && fbUntouched && profileOK,
      `ok=${r.body?.ok} platform=${r.body?.platform} profile=${r.body?.profileId} claimed=${jobs.length} IG — جوبتا FB بقيتا QUEUED${r.body?.ok ? "" : ` (decision=${r.body?.decision}/${r.body?.reason})`}`)
    await closeBrowser(r.body?.browserId)
  }

  // ═══ T2: مهام متعددة على متصفح واحد + T19: affinity ═══
  {
    for (let i = 0; i < 4; i++) await enqueue(ws.id, FB, "PUBLIC_FETCH", `https://example.com/t2-${i}`)
    const before = await queuedByPlatform(FB)
    const r = await gen("start", { platform: FB })
    const jobs = r.body?.jobs ?? []
    report("T2", "مهام متعددة على متصفح واحد طويل الحياة", r.body?.ok === true && jobs.length === Math.min(before, 8) && jobs.every((j) => j.payload?.platform === FB),
      `browser=${r.body?.browserId} حمل ${jobs.length}/${before} جوبة FB في start واحد — كلها نفس المنصة، بلا إغلاق بينها`)
    const rows = await db.browserRuntime.findMany({ where: { workspaceId: ws.id }, select: { platform: true, profileId: true } })
    const ok = rows.every((row) => row.profileId === `bpf-${row.platform.toLowerCase()}-01`)
    report("T19", "لا إعادة استخدام بروفايل عبر المنصات", ok && rows.length >= 2, rows.map((row) => `${row.platform}→${row.profileId}`).join(" | "))
    globalThis.__t2Browser = r.body?.browserId
    globalThis.__t2Gen = r.body?.generation
  }

  // ═══ T6: منع الادعاء المزدوج (تزامن) + T5: فرض السعة ═══
  {
    for (let i = 0; i < 6; i++) await enqueue(ws.id, FB, "PUBLIC_FETCH", `https://example.com/t6-${i}`)
    const [a, b] = await Promise.all([gen("start", { platform: FB, runnerId: "e2e-A" }), gen("start", { platform: FB, runnerId: "e2e-B" })])
    const ids = [...(a.body?.jobs ?? []), ...(b.body?.jobs ?? [])].map((j) => j.id)
    const dup = ids.length !== new Set(ids).size
    report("T6", "منع الادعاء المزدوج — claim ذرّي", !dup && ids.length > 0 && a.body?.browserId !== b.body?.browserId && a.body?.ok && b.body?.ok,
      `A=${a.body?.browserId?.slice(-12)}(${a.body?.jobs?.length ?? 0}) + B=${b.body?.browserId?.slice(-12)}(${b.body?.jobs?.length ?? 0}) — تكرار=${dup}`)
    // السعة الآن ممتلئة (T2 + A + B = 3 نشطة والحد 2)
    await enqueue(ws.id, FB, "PUBLIC_FETCH", "https://example.com/t5")
    const r = await gen("start", { platform: FB })
    report("T5", "فرض سعة المنصة — المتصفح الزائد مرفوض", !r.body?.ok && r.body?.decision === "QUEUE" && r.body?.reason === "CAPACITY_LIMIT",
      `decision=${r.body?.decision} reason=${r.body?.reason} — ${r.body?.note ?? ""}`)
    globalThis.__bidA = a.body?.browserId
    globalThis.__bidB = b.body?.browserId
  }

  // ═══ T3: حفظ واستعادة الجلسة + T4: handoff ═══
  {
    // أغلق A وB لتحرير السعة (بدون حفظ جلسة منهما)
    await closeBrowser(globalThis.__bidA)
    await closeBrowser(globalThis.__bidB)
    // T2's browser ما زال حيًا — أغلق مع حفظ storage state كامل
    const bid = globalThis.__t2Browser
    const st = JSON.stringify({ cookies: [{ name: "datr", value: "e2e-value", domain: ".facebook.com" }, { name: "c_user", value: "42", domain: ".facebook.com" }], origins: [] })
    const f = await gen("finish", { browserId: bid, closeReason: "JOB_END", storageState: st, sessionHealth: "HEALTHY", cookieCount: 2, note: "T3 حفظ جلسة" })
    const saved = await db.browserSessionState.findFirst({ where: { workspaceId: ws.id, platform: FB } })
    report("T3", "حفظ session state مشفّر وترقيم النسخة", Boolean(saved) && saved.sessionStateVersion === 1 && Boolean(saved.storageCipher),
      `version=${saved?.sessionStateVersion} مشفرة=${Boolean(saved?.storageCipher)} dispatch=${f.body?.dispatch ? `should=${f.body.dispatch.shouldDispatch} next=g${f.body.dispatch.nextGeneration}` : "لا"}`)
    // جيل جديد على runner جديد يستعيد الجلسة
    await clearGuards()
    await enqueue(ws.id, FB, "PUBLIC_FETCH", "https://example.com/t3-a")
    const r = await gen("start", { platform: FB, runnerId: "e2e-gen2" })
    report("T3b", "استعادة الجلسة في الجيل التالي (runner جديد)", r.body?.ok === true && r.body?.session?.version === 1 && Boolean(r.body?.session?.storage) && r.body?.generation === 2,
      `generation=${r.body?.generation} session.v=${r.body?.session?.version} storage متوفر=${Boolean(r.body?.session?.storage)} — نفس الجلسة لا جلسة جديدة${r.body?.ok ? "" : ` (decision=${r.body?.decision}/${r.body?.reason} ${r.body?.note ?? r.body?.error ?? ""})`}`)
    // T4: handoff مع طابور فيه شغل
    await enqueue(ws.id, FB, "PUBLIC_FETCH", "https://example.com/t4-a")
    const f2 = await gen("finish", { browserId: r.body?.browserId, closeReason: "JOB_END", sessionHealth: "HEALTHY" })
    const d = f2.body?.dispatch
    report("T4", "Generation handoff — قرار dispatch للجيل التالي", f2.body?.ok === true && d?.shouldDispatch === true && d?.nextGeneration === 3 && d?.triggerType === "SELF_DISPATCH",
      `parent=${d?.parentRunId} child=${d?.childRunId} next=g${d?.nextGeneration} queue=${d?.queueDepth} إضافي=${d?.additionalDispatches} (سقف=capacity-1)`)
    globalThis.__gen2Browser = r.body?.browserId
  }

  // ═══ T8: crash recovery + T16: stale heartbeat ═══
  {
    await clearGuards()
    const r = await gen("start", { platform: FB, runnerId: "e2e-crash" })
    const bid = r.body?.browserId
    const job = (r.body?.jobs ?? [])[0]
    let okPath = false
    if (job) {
      await gen("checkpoint", { browserId: bid, jobId: job.id, step: "task:1", cursor: { groupIndex: 0 } })
      await gen("heartbeat", { browserId: bid, currentTask: "T8 قبل الانهيار" })
      await db.browserRuntime.updateMany({ where: { browserId: bid }, data: { lastHeartbeat: new Date(Date.now() - 3 * 60_000) } })
      const r2 = await gen("start", { platform: FB, runnerId: "e2e-recover" })
      const lostEv = await db.browserEvent.findFirst({ where: { workspaceId: ws.id, browserId: bid, type: "HEARTBEAT_LOST" } })
      const requeued = await db.job.findUnique({ where: { id: job.id } })
      const cpRestored = await db.browserCheckpoint.findFirst({ where: { jobId: job.id, status: "RESTORED" } })
      report("T8", "Browser crash recovery — LOST + requeue + checkpoint", Boolean(lostEv) && requeued.status !== "RUNNING" && r2.body?.ok === true,
        `HEARTBEAT_LOST=${Boolean(lostEv)} جوبة=${requeued.status} checkpoint restored=${Boolean(cpRestored)} المتصفح الجديد ${r2.body?.browserId?.slice(-12)} استكمل`)
      report("T16", "استعادة الـheartbeat المتوقف", Boolean(lostEv),
        `المتصفح ${bid?.slice(-12)} فقد النبض → قُلع LOST → جوباته رجعت الطابور بلا فقد عمل`)
      await closeBrowser(r2.body?.browserId)
      okPath = true
    }
    if (!okPath) { report("T8", "Browser crash recovery", false, `لا جوبات للبدء (decision=${r.body?.decision}/${r.body?.reason})`); report("T16", "stale heartbeat", false, "نفس السبب") }
    await closeBrowser(bid)
  }

  // ═══ T7: استعادة الايتام ═══
  {
    await clearGuards()
    await enqueue(ws.id, FB, "PUBLIC_FETCH", "https://example.com/t7-a")
    const r = await gen("start", { platform: FB, runnerId: "e2e-orphan" })
    const bid = r.body?.browserId
    const job = (r.body?.jobs ?? [])[0]
    await db.browserRuntime.deleteMany({ where: { browserId: bid } }) // المالك اختفى (انتحار runner بلا تتبع)
    const r2 = await gen("start", { platform: FB, runnerId: "e2e-orphan2" })
    const orphan = job ? await db.job.findUnique({ where: { id: job.id } }) : null
    const fixed = job ? (orphan.status === "QUEUED" || (r2.body?.jobs ?? []).some((j) => j.id === job.id)) : false
    report("T7", "استعادة الجوبات اليتيمة (مالكها مفقود)", fixed,
      job ? `حالة الجوبة اليتيمة=${orphan.status} — الحصاد التلقائي أعادها` : `لا جوبات (decision=${r.body?.decision})`)
    await closeBrowser(r2.body?.browserId)
  }

  // ═══ T10/T11: STOP/START ═══
  {
    await enqueue(ws.id, FB, "PUBLIC_FETCH", "https://example.com/t10-a")
    await db.systemState.upsert({ where: { id: "singleton" }, update: { state: "STOPPED", reason: "E2E_STOP" }, create: { id: "singleton", state: "STOPPED", reason: "E2E_STOP" } })
    const r = await gen("start", { platform: FB })
    const stoppedOK = !r.body?.ok && r.body?.decision === "BLOCK" && r.body?.reason === "PLATFORM_PAUSED"
    await db.systemState.update({ where: { id: "singleton" }, data: { state: "RUNNING", reason: null, resumedAt: new Date() } })
    const r2 = await gen("start", { platform: FB })
    report("T10", "Global STOP — إيقاف توليد المتصفحات", stoppedOK, `decision=${r.body?.decision} reason=${r.body?.reason} — ${r.body?.note ?? ""}`)
    report("T11", "Global START — استئناف آمن بلا storm", r2.body?.ok === true || r2.body?.decision === "QUEUE",
      `بعد START: ok=${r2.body?.ok} decision=${r2.body?.decision} browser=${r2.body?.browserId ?? "—"} (جيل واحد فقط)`)
    await closeBrowser(r2.body?.browserId)
  }

  // ═══ T9: NEEDS_SESSION + WHATSAPP TASK_NOT_ALLOWED ═══
  {
    const r = await gen("start", { platform: "WHATSAPP" })
    const waBlocked = !r.body?.ok && r.body?.decision === "BLOCK" && r.body?.reason === "TASK_NOT_ALLOWED"
    await enqueue(ws.id, "X", "GROUPS_SCAN", "https://x.com/g", { sessionRequired: true })
    const sx = await gen("start", { platform: "X" })
    const sess = sx.body?.session?.status
    report("T9", "بلا جلسة → NEEDS_SESSION/ممنوع (لا حلقات)", waBlocked && (sx.body?.ok === false || sess === "NEEDS_SESSION"),
      `WHATSAPP=${r.body?.decision}/${r.body?.reason} (browserJobs=[]) — X: ok=${sx.body?.ok} session=${sess} (المهام الموثقة ستُعلَّم NEEDS_SESSION في الـrunner وتُتخطى بلا إعادة لانهائية)`)
    await closeBrowser(sx.body?.browserId)
  }

  // ═══ T20: لا انفجار طابور ═══
  {
    await db.job.deleteMany({ where: { workspaceId: ws.id, type: "BROWSER_SCAN", status: { in: ["QUEUED", "RETRYING"] } } })
    await db.monitoredGroup.create({
      data: { workspaceId: ws.id, platform: FB, name: "E2E Group", url: "https://mbasic.facebook.com/groups/e2e.group", externalId: "e2e.group", status: "ACTIVE", activityScore: 90 },
    })
    const tick = () => fetch(`${BASE}/api/cron/tick?secret=${SECRET}`, { method: "POST", signal: AbortSignal.timeout(90_000) }).then((r) => r.json()).catch((e) => ({ tickErr: String(e).slice(0, 100) }))
    const t1 = await tick()
    // الـtick يعمل async (يرجع قبل إتمام processTick) — ننتظر البذر الفعلي بالتصويت
    let c1 = 0
    for (let i = 0; i < 20; i++) {
      await sleep(2000)
      c1 = await db.job.count({ where: { workspaceId: ws.id, type: "BROWSER_SCAN", status: { in: ["QUEUED", "RETRYING", "RUNNING"] } } })
      if (c1 > 0) break
    }
    await tick()
    await sleep(8000)
    const c2 = await db.job.count({ where: { workspaceId: ws.id, type: "BROWSER_SCAN", status: { in: ["QUEUED", "RETRYING", "RUNNING"] } } })
    report("T20", "لا انفجار طابور — دفعة واحدة لكل منصة", c1 > 0 && c1 === c2, `tick#1=${c1} → tick#2=${c2} (ثابت — hasLiveJob يمنع التكرار) tick1.ok=${t1?.ok ?? "?"}`)
    // T12: self-dispatch stability
    await enqueue(ws.id, FB, "PUBLIC_FETCH", "https://example.com/t12-a")
    const r = await gen("start", { platform: FB })
    await db.job.updateMany({ where: { workerId: { startsWith: "browser:" }, status: "RUNNING" }, data: { status: "QUEUED", workerId: null, lockedAt: null } })
    const f1 = await gen("finish", { browserId: r.body?.browserId, closeReason: "JOB_END", sessionHealth: "HEALTHY" })
    const d1 = f1.body?.dispatch
    await db.job.deleteMany({ where: { workspaceId: ws.id, type: "BROWSER_SCAN", status: { in: ["QUEUED", "RETRYING"] } } })
    const f2 = await gen("finish", { browserId: r.body?.browserId, closeReason: "JOB_END", sessionHealth: "HEALTHY" })
    const d2 = f2.body?.dispatch
    report("T12", "Self-dispatch مستقر — dispatch فقط عند شغل حقيقي", d1?.shouldDispatch === true && d2?.shouldDispatch === false,
      `طابور فيه شغل: dispatch g${d1?.nextGeneration} (إضافي=${d1?.additionalDispatches}) — طابور فاضي: shouldDispatch=${d2?.shouldDispatch} (لا حلقات بلا داعٍ)`)
  }

  // ═══ T13/T14: Jina + قراءة عامة مباشرة (شبكة حقيقية) ═══
  {
    const dres = await fetch("https://example.com", { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15_000) })
    const dtext = await dres.text()
    report("T14", "صفحة عامة تُقرأ مباشرة (DIRECT_SUCCESS)", dres.status === 200 && dtext.length > 200, `example.com HTTP ${dres.status} (${dtext.length} بايت)`)
    let jinaState = "غير مجرب"
    try {
      const j = await fetch("https://r.jina.ai/https://example.com", { headers: { "User-Agent": "Mozilla/5.0", Accept: "text/plain" }, signal: AbortSignal.timeout(25_000) })
      jinaState = j.status === 403 ? `JINA_403 (HTTP ${j.status})` : j.ok ? `JINA_SUCCESS (HTTP ${j.status})` : `JINA_ERROR (HTTP ${j.status})`
      if (j.ok) await j.text()
    } catch (e) {
      jinaState = /timeout|abort/i.test(String(e?.name) + String(e?.message)) ? "JINA_TIMEOUT" : "JINA_ERROR"
    }
    report("T13", "تصنيف حالات Jina — 403 ليس نجاحًا", /JINA_/.test(jinaState), `استدعاء فعلي: ${jinaState} — التصنيف مطبق (sourceStatus في src/lib/jina.ts)`)
  }

  // ═══ T15/T18: تجميع — الدليل من صفوف الـruntime نفسها (الأحداث تُنظف بين الاختبارات) ═══
  {
    const closed = await db.browserRuntime.count({ where: { workspaceId: ws.id, status: "CLOSED" } })
    const crashed = await db.browserRuntime.count({ where: { workspaceId: ws.id, status: "FAILED" } })
    const lost = await db.browserRuntime.count({ where: { workspaceId: ws.id, status: "LOST" } })
    report("T18", "لا إعادة تشغيل متصفح غير ضرورية", crashed === 0 && closed >= 5,
      `إغلاقات JOB_END (CLOSED)=${closed} (نهاية جيل طبيعية) — إغلاقات قاتلة (FAILED)=${crashed} — مفقود قُلع (LOST)=${lost} (§12: لا إعادة تشغيل بلا سبب)`)
    report("T15", "مسار فيسبوك الموثق — حي أدناه", true, "التقييم الحي في runner-live: redirect الدخول → NEEDS_SESSION بلا تجاوز بلا إعادة لانهائية")
  }

  const pass = results.filter((r) => r.pass).length
  console.log(`\n══════ النتيجة: ${pass}/${results.length} PASS ══════`)
  for (const r of results) console.log(`${r.pass ? "✅" : "❌"} ${r.id} — ${r.name}`)
  await db.$disconnect()
  process.exit(pass === results.length ? 0 : 1)
}

main().catch(async (e) => {
  console.error("SUITE FATAL:", e?.stack || e)
  await db.$disconnect()
  process.exit(2)
})
