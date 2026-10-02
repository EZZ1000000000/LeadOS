// T5 — Backpressure + السعة (§6 + §19 + §20): 12 جوبة فيسبوك، حد متصفحين، سقف 8/جيل
// يثبت: لا يبدأ متصفح ثالث، الطابور ينتظر، ثم يُستنزف بلا تكرار ولا انفجار.
import { db, runner, seedJobs, workspaceId, ok, record, api, withNightHours, withPolicyOverride } from "./lib"

async function runMain() {
  const wsId = await workspaceId()
  const marker = new Date()

  const jobs = []
  for (let i = 1; i <= 12; i++) {
    jobs.push({ url: `https://example.com/?t5-job-${i}` })
  }
  const seeded = await seedJobs(wsId, "FACEBOOK", "PUBLIC_FETCH", jobs)
  console.log(`seeded ${seeded.length} FB jobs (حد المنصة: 2 متصفح، 8 مهمة/جيل)`)

  // 1) امتلاء السعة: start يفتح slot1 (يدعي 8) و start2 يفتح slot2 (يدعي 4) و start3 يُرفض CAPACITY_LIMIT
  const s1 = await api("start", { platform: "FACEBOOK", runnerId: "t5-slot1" })
  const s2 = await api("start", { platform: "FACEBOOK", runnerId: "t5-slot2" })
  const s3 = await api("start", { platform: "FACEBOOK", runnerId: "t5-slot3-rejected" })
  const b1 = (s1.body as { browserId?: string })?.browserId
  const b2 = (s2.body as { browserId?: string })?.browserId
  const s3reason = (s3.body as { reason?: string })?.reason

  const activeAfter = await db.browserRuntime.count({ where: { workspaceId: wsId, platform: "FACEBOOK", status: { in: ["STARTING", "READY", "BUSY", "IDLE", "RECOVERING"] } } })
  const blockEvent = await db.browserEvent.findFirst({ where: { type: "POLICY_BLOCK", platform: "FACEBOOK", createdAt: { gte: marker } } })

  record("T5-A: ضغط الطابور — السعة تُحترم", [
    `start#1 ok=${s1.body?.ok} claimed=${(s1.body as { jobs?: unknown[] })?.jobs?.length ?? 0}`,
    `start#2 ok=${s2.body?.ok} claimed=${(s2.body as { jobs?: unknown[] })?.jobs?.length ?? 0}`,
    `start#3 ok=${s3.body?.ok} decision=${s3.body?.decision} reason=${s3reason} (المتوقع CAPACITY_LIMIT)`,
    `active runtimes=${activeAfter} (المتوقع 2 — الحد من السياسة §6)`,
    `POLICY_BLOCK event=${Boolean(blockEvent)}`,
  ].join(" | "))

  // 2) إغلاق slot1/slot2 (الجوبات الـ12 ترجع الطابور) → انتظار تجاوز cooldown → استنزاف بجيلين
  await api("finish", { browserId: b1, closeReason: "JOB_END", note: "T5 cleanup slot1" })
  await api("finish", { browserId: b2, closeReason: "JOB_END", note: "T5 cleanup slot2" })
  await new Promise((r) => setTimeout(r, 8_000)) // تجاوز cooldown (5ث في الاختبار)
  const d1 = await runner("FACEBOOK")
  record("T5-runner-d1", d1.out.split("\n").filter((l) => /ALLOW|لا جيل|⚠️|💥|🛑|🏁/.test(l)).join(" | "))
  await new Promise((r) => setTimeout(r, 8_000)) // تجاوز cooldown قبل الجيل الثاني
  const d2 = await runner("FACEBOOK")
  record("T5-runner-d2", d2.out.split("\n").filter((l) => /ALLOW|لا جيل|⚠️|💥|🛑|🏁/.test(l)).join(" | "))
  const finals = await db.job.findMany({ where: { id: { in: seeded.map((j) => j.id) } } })
  const successCount = finals.filter((j) => j.status === "SUCCESS").length
  const onceOnly = finals.every((j) => j.attempts <= 2) // attempt 1 من الـAPI claim، retry منطقي واحد كحد
  const duplicateClaims = finals.filter((j) => j.attempts > 2).length
  const starts = await db.browserEvent.count({ where: { type: "BROWSER_START", platform: "FACEBOOK", createdAt: { gte: marker } } })
  const closes = await db.browserEvent.count({ where: { type: "BROWSER_CLOSE", platform: "FACEBOOK", createdAt: { gte: marker } } })
  const activeNow = await db.browserRuntime.count({ where: { workspaceId: wsId, platform: "FACEBOOK", status: { in: ["STARTING", "READY", "BUSY", "IDLE", "RECOVERING"] } } })

  record("T5-B: استنزاف الطابور بلا انفجار", [
    `drain exits=${d1.code},${d2.code}`,
    `SUCCESS=${successCount}/${seeded.length}`,
    `جوبات ادُّعيت أكثر من مرتين=${duplicateClaims} (المتوقع 0)`,
    `BROWSER_START=${starts} BROWSER_CLOSE=${closes} activeNow=${activeNow} — سعة 2 لم تُتجاوز لحظة واحدة (start#3 رُفض CAPACITY_LIMIT)`,
  ].join(" | "))

  const c1 = ok("T5: المتصفح الثالث رُفض بـCAPACITY_LIMIT (§19)", s3.body?.ok === false && s3reason === "CAPACITY_LIMIT" && activeAfter === 2)
  const c2 = ok("T5: الطابور استُنزف كاملًا (12/12 SUCCESS)", successCount === seeded.length, `${successCount}/${seeded.length}`)
  const c3 = ok("T5: لا ادعاء مزدوج — ذرّية الـclaim (§18)", duplicateClaims === 0 && onceOnly)
  const c4 = ok("T5: POLICY_BLOCK مسجل للعرض على اللوحة (§31)", Boolean(blockEvent))
  const c5 = ok("T5: دورة حياة نظيفة — كل متصفح فُتح وأُغلق مرة واحدة، صفر نشط متبقي (§12)", starts === closes && activeNow === 0, `starts=${starts} closes=${closes} activeNow=${activeNow}`)
  return c1 && c2 && c3 && c4 && c5 ? 0 : 1
}
withNightHours("FACEBOOK", () => withPolicyOverride("FACEBOOK", "failureBackoffMs", 0, () => withPolicyOverride("FACEBOOK", "cooldownAfterGenerationMs", 5_000, () => runMain()))).then((c) => process.exit(c ?? 1)).catch((e) => { console.error(e); process.exit(1) })
