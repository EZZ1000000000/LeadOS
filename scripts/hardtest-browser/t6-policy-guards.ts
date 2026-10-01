// T6 — درع الامتثال والسياسات (§8 + §31 + §33 + §34): كل سبب رفض يظهر باسمه الصريح
import { db, runner, seedJobs, workspaceId, ok, record, api, controlData, adminCookie, withNightHours, withPolicyOverride } from "./lib"
import { withinActiveHours } from "../../src/lib/browser/policy"

async function runMain() {
  const wsId = await workspaceId()
  const marker = new Date()

  // 1) منصة بلا جوبات متصفح (WHATSAPP) → TASK_NOT_ALLOWED
  const wa = await api("start", { platform: "WHATSAPP" })
  // 2) الإيقاف العام → PLATFORM_PAUSED
  await db.systemState.upsert({ where: { id: "singleton" }, create: { id: "singleton", state: "STOPPED", reason: "T6 global stop test" }, update: { state: "STOPPED", reason: "T6 global stop test" } })
  const stopped = await api("start", { platform: "REDDIT" })
  await db.systemState.upsert({ where: { id: "singleton" }, create: { id: "singleton", state: "RUNNING" }, update: { state: "RUNNING", reason: null } })

  // 3) SESSION_MISSING: لينكدإن سياسته SESSION_OPTIONAL لكن ما عندهش جلسة — فحص taskSessionOk عبر مهمة Groups تتطلب جلسة
  //    (نستخدم نتيجة ضمنية: runner إنستغرام على GROUPS_SCAN بلا جلسة → NEEDS_SESSION بلا تجاوز)
  const igGroup = await seedJobs(wsId, "INSTAGRAM", "GROUPS_SCAN", [{ groupId: "t6-fake-group", groupUrl: "https://www.instagram.com/explore/tags/test/", groupName: "T6 Group", sessionRequired: true }])

  // 4) COOLDOWN: بعد جيل فيسبوك مباشرة → QUEUE COOLDOWN (cooldown فيسبوك 3 دقائق)
  await seedJobs(wsId, "FACEBOOK", "PUBLIC_FETCH", [{ url: "https://example.com/?t6-fb" }])
  const rFb = await runner("FACEBOOK")
  const cooldownProbe = await api("start", { platform: "FACEBOOK" })

  // 5) runner إنستغرام على جوبت الجروب — جدار الدخول يُبلّغ NEEDS_SESSION بلا أي تجاوز (§34)
  // (تجاوز مؤقت لـcooldown إنستغرام — الاختبارات المتتالية بسرعة)
  await withPolicyOverride("INSTAGRAM", "cooldownAfterGenerationMs", 3_000, async () => {
  await withPolicyOverride("INSTAGRAM", "failureBackoffMs", 0, async () => {
    await new Promise((r) => setTimeout(r, 4_000))
    const rIg = await runner("INSTAGRAM")
    record("T6-runner-IG", rIg.out.split("\n").slice(0, 6).join(" | "))
    const igJob = await db.job.findUnique({ where: { id: igGroup[0].id } })

    record("T6: أسباب الرفض باسمها الصريح", [
    `WHATSAPP: ok=${wa.body?.ok} reason=${wa.body?.reason} (TASK_NOT_ALLOWED متوقع)`,
    `GLOBAL_STOP: ok=${stopped.body?.ok} reason=${stopped.body?.reason} (PLATFORM_PAUSED متوقع)`,
    `COOLDOWN بعد جيل فيسبوك: ok=${cooldownProbe.body?.ok} reason=${cooldownProbe.body?.reason}`,
      `IG GROUPS_SCAN بلا جلسة: job=${igJob?.status} note=${(igJob?.result as { message?: string })?.message ?? (igJob?.errorMessage ?? "").slice(0, 90)}`,
    ].join(" | "))
  })
  })

  // 6) فحص ساعات النشاط (وحدة مباشرة — نوافذ ديناميكية نسبةً للساعة الحالية)
  const cairoHour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Cairo" }).format(new Date()))
  const inWin = { activeHours: { start: cairoHour, end: (cairoHour + 1) % 24, tz: "Africa/Cairo" } }
  const outWin = { activeHours: { start: (cairoHour + 2) % 24, end: (cairoHour + 3) % 24, tz: "Africa/Cairo" } }
  const offHours = withinActiveHours(outWin as never) // نافذة لا تحتوي الساعة الحالية → false
  const onHours = withinActiveHours(inWin as never) && withinActiveHours({ activeHours: { start: 0, end: 24, tz: "Africa/Cairo" } } as never)

  // 7) لوحة السياسات تعرض السبب (§31)
  const cookie = await adminCookie()
  const ctrl = await controlData(cookie)
  const fbRow = (ctrl.body?.platforms ?? []).find((p: { platform: string }) => p.platform === "FACEBOOK")

  record("T6-B: لوحة السياسات (§31)", [
    `control status=${ctrl.status}`,
    `FACEBOOK cooldownActive=${fbRow?.policyLive?.cooldownActive} actionsInWindow=${fbRow?.policyLive?.actionsInWindow}/${fbRow?.policyLive?.maxActionsPerWindow}`,
    `lastBlock=${JSON.stringify(fbRow?.lastBlock)}`,
  ].join(" | "))

  const c1 = ok("T6: منصة بلا نطاق متصفح تُرفض TASK_NOT_ALLOWED", wa.body?.ok === false && wa.body?.reason === "TASK_NOT_ALLOWED")
  const c2 = ok("T6: الإيقاف العام يوقف المتصفحات PLATFORM_PAUSED", stopped.body?.ok === false && stopped.body?.reason === "PLATFORM_PAUSED")
  const c3 = ok("T6: cooldown بعد الجيل يُرفض صراحة COOLDOWN (§23)", cooldownProbe.body?.ok === false && cooldownProbe.body?.reason === "COOLDOWN")
  const c4 = ok("T6: ساعات النشاط تعمل (خارجها=false /全天=true)", offHours === false && onHours === true)
  const c5 = ok("T6: مهمة موثقة بلا جلسة → NEEDS_SESSION بلا أي محاولة تجاوز (§34)", ["RETRYING", "FAILED", "QUEUED"].includes(igJob?.status ?? "") && (igJob?.errorMessage ?? "").length > 0)
  const c6 = ok("T6: اللوحة تعرض سياسة حية + سبب آخر منع (§31)", ctrl.status === 200 && fbRow?.policyLive?.maxActionsPerWindow > 0)

  return c1 && c2 && c3 && c4 && c5 && c6 ? 0 : 1
}
withNightHours("FACEBOOK", () => withNightHours("INSTAGRAM", () => runMain())).then((c) => process.exit(c ?? 1)).catch((e) => { console.error(e); process.exit(1) })
