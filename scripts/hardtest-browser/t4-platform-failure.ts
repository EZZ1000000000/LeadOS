// T4 — عزل فشل منصة (§26 + §27): فشل فيسبوك ≠ فشل النظام — إنستغرام تكمّل عادي
import { db, runner, seedJobs, workspaceId, ok, record, withNightHours } from "./lib"

async function runMain() {
  const wsId = await workspaceId()
  const marker = new Date()

  // جوبة فيسبوك لنطاق غير موجود (فشل حتمي) + جوبتا إنستغرام سليمتان
  const fbBad = await seedJobs(wsId, "FACEBOOK", "PUBLIC_FETCH", [{ url: "https://nonexistent-domain-xyz-test-9f2d.invalid/t4" }])
  const igGood = await seedJobs(wsId, "INSTAGRAM", "PUBLIC_FETCH", [{ url: "https://example.com/?t4-ig-a" }, { url: "https://example.com/?t4-ig-b" }])

  // 1) جيل فيسبوك — سيفشل (exit 1)
  const rFb = await runner("FACEBOOK")
  const fbJob = await db.job.findUnique({ where: { id: fbBad[0].id } })
  const fbFailEvent = await db.browserEvent.findFirst({ where: { type: "TASK_FAILED", platform: "FACEBOOK", createdAt: { gte: marker } } })

  record("T4-A: فشل منصة واحدة — قراءة صادقة", [
    `runner exit=${rFb.code} (1 متوقع — لا تمويه)`,
    `job status=${fbJob?.status} attempts=${fbJob?.attempts} errorMessage=${(fbJob?.errorMessage ?? "").slice(0, 80)}`,
    `TASK_FAILED event=${Boolean(fbFailEvent)}`,
    `scheduledAt future (backoff)=${fbJob?.scheduledAt && fbJob.scheduledAt > new Date()}`,
  ].join(" | "))

  // 2) جيل إنستغرام — يكمل عادي رغم فشل فيسبوك
  const rIg = await runner("INSTAGRAM")
  const igJobs = await db.job.findMany({ where: { id: { in: igGood.map((j) => j.id) } } })
  const igDone = igJobs.filter((j) => j.status === "SUCCESS").length

  record("T4-B: بقية المنصات مستمرة", [
    `runner exit=${rIg.code}`,
    `IG jobs SUCCESS=${igDone}/${igGood.length}`,
  ].join(" | "))

  // 3) فحص السياسات: المنصة في backoff → start يرفض مؤقتًا (لا حلقة فشل)
  const igJobsAfter = await db.job.findMany({ where: { id: { in: igGood.map((j) => j.id) } } })

  const c1 = ok("T4: فشل فيسبوك سُجّل صادقًا (FAILED/RETRYING + TASK_FAILED)", (fbJob?.status === "RETRYING" || fbJob?.status === "FAILED") && Boolean(fbFailEvent))
  const c2 = ok("T4: backoff مُطبق — إعادة محاولة مجدولة مستقبلًا وفق سياسة المنصة", Boolean(fbJob?.scheduledAt && fbJob.scheduledAt > new Date()))
  const c3 = ok("T4: إنستغرام كملت نجاحًا بعد فشل فيسبوك — عزل كامل (§27)", igDone === igGood.length, `exit=${rIg.code}`)
  const c4 = ok("T4: النظام ما زال صحيًا — لا انسحاب عام", rIg.code === 0)

  return c1 && c2 && c3 && c4 ? 0 : 1
}
withNightHours("FACEBOOK", () => withNightHours("INSTAGRAM", () => runMain())).then((c) => process.exit(c ?? 1)).catch((e) => { console.error(e); process.exit(1) })
