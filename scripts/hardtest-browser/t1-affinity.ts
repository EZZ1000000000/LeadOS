// T1 — Affinity + Long-lived browser (طلب §1 + §2 + §12 + §16 + §35)
// يثبت: متصفح واحد = منصة واحدة، مهام كثيرة على متصفح واحد بلا إغلاق بينها، إغلاق واحد عند النهاية.
import { db, runner, seedJobs, workspaceId, ok, record, withNightHours } from "./lib"

async function runMain() {
  const wsId = await workspaceId()
  const marker = new Date()

  // بذر: جوبتين فيسبوك + جوبتين إنستغرام — PUBLIC_FETCH على صفحة اختبار عامة
  const fb = await seedJobs(wsId, "FACEBOOK", "PUBLIC_FETCH", [{ url: "https://example.com/?t1-fb-a" }, { url: "https://example.com/?t1-fb-b" }])
  const ig = await seedJobs(wsId, "INSTAGRAM", "PUBLIC_FETCH", [{ url: "https://example.com/?t1-ig-a" }, { url: "https://example.com/?t1-ig-b" }])
  console.log(`seeded: ${fb.length} FB + ${ig.length} IG`)

  // ═══ الجيل 1: فيسبوك ═══
  const r1 = await runner("FACEBOOK")
  const browser1 = await db.browserRuntime.findFirst({ where: { platform: "FACEBOOK", startedAt: { gte: marker } }, orderBy: { startedAt: "desc" } })
  const fbDone = await db.browserEvent.count({ where: { type: "TASK_DONE", browserId: browser1?.browserId, createdAt: { gte: marker } } })
  const fbClose = await db.browserEvent.count({ where: { type: "BROWSER_CLOSE", browserId: browser1?.browserId } })
  const fbJobs = await db.job.findMany({ where: { id: { in: fb.map((j) => j.id) } } })
  const fbAllSuccess = fbJobs.every((j) => j.status === "SUCCESS")
  const fbSingleWorker = new Set(fbJobs.map((j) => j.workerId)).size === 1

  record("T1-A: جيل فيسبوك — متصفح واحد لمهمتي منصته فقط", [
    `runner exit=${r1.code}`,
    `browserId=${browser1?.browserId} profileId=${browser1?.profileId} generation=${browser1?.generation}`,
    `TASK_DONE لهذا المتصفح=${fbDone} (المتوقع 2)`,
    `BROWSER_CLOSE لهذا المتصفح=${fbClose} (المتوقع 1 — إغلاق واحد في النهاية §2)`,
    `جوبات فيسبوك STATUS=${fbJobs.map((j) => j.status).join(",")} workerIds unique=${fbSingleWorker}`,
  ].join(" | "))

  // ═══ الجيل 2: إنستغرام ═══
  const r2 = await runner("INSTAGRAM")
  const browser2 = await db.browserRuntime.findFirst({ where: { platform: "INSTAGRAM", startedAt: { gte: marker } }, orderBy: { startedAt: "desc" } })
  const igJobs = await db.job.findMany({ where: { id: { in: ig.map((j) => j.id) } } })

  record("T1-B: جيل إنستغرام — متصفح مختلف ببروفايل مختلف", [
    `runner exit=${r2.code}`,
    `browserId=${browser2?.browserId} profileId=${browser2?.profileId}`,
    `جوبات إنستغرام STATUS=${igJobs.map((j) => j.status).join(",")}`,
  ].join(" | "))

  // ═══ الحكم ═══
  const c1 = ok("T1: متصفح فيسبوك أنجز جوبتي فيسبوك فقط (workerId واحد)", fbAllSuccess && fbSingleWorker, `exit=${r1.code}`)
  const c2 = ok("T1: إغلاق واحد في نهاية الـJob — لا إغلاق بين المهام (§2)", fbClose === 1, `closes=${fbClose}`)
  const c3 = ok("T1: بروفايلات مختلفة للمنصتين — لا تلوث عرضي (§5)", browser1?.profileId !== browser2?.profileId && browser1?.profileId === "bpf-facebook-01" && browser2?.profileId === "bpf-instagram-01", `${browser1?.profileId} vs ${browser2?.profileId}`)
  const c4 = ok("T1: جوبات إنستغرام نجحت على متصفحها", igJobs.every((j) => j.status === "SUCCESS"), `exit=${r2.code}`)

  const allFbWorkerIds = (await db.job.findMany({ where: { id: { in: fb.map((j) => j.id) } }, select: { workerId: true } })).map((j) => j.workerId)
  const allIgWorkerIds = (await db.job.findMany({ where: { id: { in: ig.map((j) => j.id) } }, select: { workerId: true } })).map((j) => j.workerId)
  const noCross = !allFbWorkerIds.some((w) => allIgWorkerIds.includes(w))
  const c5 = ok("T1: صفر تلوث عرضي بين المنصتين (§35)", noCross)

  return c1 && c2 && c3 && c4 && c5 ? 0 : 1
}
withNightHours("FACEBOOK", () => withNightHours("INSTAGRAM", () => runMain())).then((c) => process.exit(c ?? 1)).catch((e) => { console.error(e); process.exit(1) })
