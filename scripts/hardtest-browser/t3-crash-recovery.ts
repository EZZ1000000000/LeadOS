// T3 — فقدان المتصفح: heartbeat stale → LOST → requeue → متصفح جديد نفس المنصة → استكمال من checkpoint (§13 + §14 + §25)
import { db, runner, seedJobs, workspaceId, ok, record, api, adminCookie, controlData, withNightHours } from "./lib"

async function runMain() {
  const wsId = await workspaceId()
  const marker = new Date()

  // جوبة ريديت واحدة (عامة — لا جلسة) + cooldown ريديت 60ث يكفي لأن النبض سيبتلعها قبلها؟
  // لا — سنستخدم الفحص عبر API مباشرة قبل cooldown المهم.
  const [job] = await seedJobs(wsId, "REDDIT", "PUBLIC_FETCH", [{ url: "https://example.com/?t3-lost" }])

  // 1) فتح متصفح عبر API (بدون runner) — محاكاة متصفح عاش ثم فُقد
  // (انتظار حتى يسمح درع الامتثال — cooldown الجولة السابقة قد يكون نشطًا)
  let browserId: string | undefined
  for (let attempt = 0; attempt < 8 && !browserId; attempt++) {
    const start = await api("start", { platform: "REDDIT", runnerId: "t3-doomed" })
    const body = start.body as { ok?: boolean; browserId?: string; reason?: string }
    if (body.ok && body.browserId) browserId = body.browserId
    else { console.log(`start refused (${body.reason}) — retry in 20s`); await new Promise((r) => setTimeout(r, 20_000)) }
  }
  if (!browserId) { console.log("لم يُسمح بفتح متصفح — فشل الاختبار"); return 1 }
  console.log(`opened browser ${browserId}`)

  // 2) نبضة واحدة + checkpoint قبل العملية الطويلة
  await api("heartbeat", { browserId, currentTask: "T3: سأفقد بعد لحظة" })
  await api("checkpoint", { browserId, jobId: job.id, step: "t3:before-loss", cursor: { groupIndex: 0 } })

  // 3) الموت الصامت — لا نبضات أخرى
  console.log("browser lost (no heartbeats) — waiting 130s for stale detection (2min threshold + margin)...")
  await new Promise((r) => setTimeout(r, 130_000))

  // 4) الكشف — نداء اللوحة يشغّل reapLostBrowsers (بلا فتح runtime جديد يسرق الجوبة)
  const cookie3 = await adminCookie()
  await controlData(cookie3)
  const lostRt = await db.browserRuntime.findUnique({ where: { browserId: browserId! } })
  const jobAfter = await db.job.findUnique({ where: { id: job.id } })
  const lostEvent = await db.browserEvent.findFirst({ where: { type: "HEARTBEAT_LOST", browserId, createdAt: { gte: marker } } })

  record("T3-A: كشف الفقد الذاتي", [
    `runtime status=${lostRt?.status} (المتوقع LOST)`,
    `job status=${jobAfter?.status} workerId=${jobAfter?.workerId ?? "null"} (المتوقع QUEUED بلا owner)`,
    `HEARTBEAT_LOST event=${Boolean(lostEvent)} — requeued=${(lostEvent?.detail as { requeued?: number })?.requeued}`,
  ].join(" | "))

  // 5) التعافي — runner جديد من نفس المنصة يستلم نفس الجوبة + checkpoint
  const rec = await runner("REDDIT")
  const newRt = await db.browserRuntime.findFirst({ where: { platform: "REDDIT", startedAt: { gte: marker }, browserId: { not: browserId! } }, orderBy: { startedAt: "desc" } })
  const jobFinal = await db.job.findUnique({ where: { id: job.id } })
  const cp = await db.browserCheckpoint.findFirst({ where: { jobId: job.id, status: "RESTORED" } })
  const sameProfile = newRt?.profileId === lostRt?.profileId

  record("T3-B: التعافي بمتصفح جديد من نفس المنصة", [
    `runner exit=${rec.code}`,
    `new browserId=${newRt?.browserId} same profileId=${sameProfile} (${newRt?.profileId})`,
    `job final status=${jobFinal?.status}`,
    `checkpoint RESTORED=${Boolean(cp)} step=${cp?.step} restoredAt=${cp?.restoredAt?.toISOString() ?? "—"}`,
  ].join(" | "))

  // ═══ الحكم ═══
  const c1 = ok("T3: النظام كشف فقد المتصفح تلقائيًا (LOST + HEARTBEAT_LOST)", lostRt?.status === "LOST" && Boolean(lostEvent))
  const c2 = ok("T3: جوبة الفقد رجعت الطابور بلا تدخل (requeue)", jobAfter?.status === "QUEUED" && jobAfter?.workerId === null)
  const c3 = ok("T3: متصفح جديد من نفس المنصة ونفس البروفايل استكمل", sameProfile && jobFinal?.status === "SUCCESS", `${newRt?.profileId}`)
  const c4 = ok("T3: checkpoint استُعيد — لا إعادة من الصفر (§14)", Boolean(cp))
  const c5 = ok("T3: runner التعافي أكمل بنجاح", rec.code === 0)

  return c1 && c2 && c3 && c4 && c5 ? 0 : 1
}
withNightHours("REDDIT", () => runMain()).then((c) => process.exit(c ?? 1)).catch((e) => { console.error(e); process.exit(1) })
