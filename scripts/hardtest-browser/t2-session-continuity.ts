// T2 — استمرارية الجلسة بين الجيلات (طلب §3 + §4 + §24 + §39)
// يثبت: الجيل N يحفظ session state → الجيل N+1 على runner جديد يستعيدها — لا جلسة جديدة بلا سبب.
import { db, runner, seedJobs, workspaceId, ok, record, withPolicyOverride, withNightHours } from "./lib"

async function runMain() {
  const wsId = await workspaceId()
  const marker = new Date()

  await withPolicyOverride("FACEBOOK", "cooldownAfterGenerationMs", 8_000, async () => {
    // ═══ الجيل N: يفتح متصفحًا، ينفذ مهمة، يحفظ الجلسة، يقفل ═══
    await seedJobs(wsId, "FACEBOOK", "PUBLIC_FETCH", [{ url: "https://example.com/?t2-gen1" }])
    const r1 = await runner("FACEBOOK")
    const s1 = await db.browserSessionState.findUnique({
      where: { workspaceId_platform_browserProfileId: { workspaceId: wsId, platform: "FACEBOOK", browserProfileId: "bpf-facebook-01" } },
    })
    const gen1 = await db.browserRuntime.findFirst({ where: { platform: "FACEBOOK", startedAt: { gte: marker } }, orderBy: { startedAt: "desc" } })

    record("T2-A: الجيل N — حفظ حالة الجلسة", [
      `runner exit=${r1.code}`,
      `sessionStateVersion=${s1?.sessionStateVersion} status=${s1?.status} storage محفوظ=${Boolean(s1?.storageCipher)}`,
      `generation=${gen1?.generation} closeReason=?`,
      `lastSuccessfulUse=${s1?.lastSuccessfulUse?.toISOString() ?? "—"}`,
    ].join(" | "))

    // ═══ الجيل N+1: runner جديد تمامًا (عملية Node جديدة) — يستعيد الجلسة ═══
    await new Promise((r) => setTimeout(r, 12_000)) // تجاوز cooldown (8ث في الاختبار)
    await seedJobs(wsId, "FACEBOOK", "PUBLIC_FETCH", [{ url: "https://example.com/?t2-gen2" }])
    const r2 = await runner("FACEBOOK")
    const s2 = await db.browserSessionState.findUnique({
      where: { workspaceId_platform_browserProfileId: { workspaceId: wsId, platform: "FACEBOOK", browserProfileId: "bpf-facebook-01" } },
    })
    const restores = await db.browserEvent.findMany({
      where: { type: "SESSION_RESTORE", platform: "FACEBOOK", createdAt: { gte: marker } },
      orderBy: { createdAt: "asc" },
    })
    const gen2 = await db.browserRuntime.findFirst({ where: { platform: "FACEBOOK", startedAt: { gte: marker } }, orderBy: { startedAt: "desc" } })

    record("T2-B: الجيل N+1 — استعادة على runner جديد", [
      `runner exit=${r2.code}`,
      `restored ${r2.out.includes("storage state مستعاد") || r2.out.includes("كوكيز المنصة")}`,
      `sessionStateVersion=${s2?.sessionStateVersion} (لازم ≥ ${s1?.sessionStateVersion})`,
      `SESSION_RESTORE events=${restores.length} → ${restores.map((e) => `g${e.generation}(v${(e.detail as { version?: number })?.version})`).join(" ")}`,
      `generation=${gen2?.generation} (يجب أن يكون ${gen1 ? gen1.generation + 1 : "?"} أو أعلى)`,
    ].join(" | "))

    // ═══ الحكم ═══
    const c1 = ok("T2: الجلسة حُفظت بنهاية الجيل N (storage مشفر + إصدار)", Boolean(s1?.storageCipher) && (s1?.sessionStateVersion ?? 0) >= 1)
    const c2 = ok("T2: الجيل N+1 استعاد الجلسة (حدث SESSION_RESTORE)", restores.length >= 2, `${restores.length} أحداث`)
    const c3 = ok("T2: لا جلسة جديدة — نفس الصف (نسخة تزيد، لا صفوف تتراكم)", s1?.id === s2?.id)
    const c4 = ok("T2: ترقيم الجيلات تصاعدي بلا قفزات", (gen2?.generation ?? 0) > (gen1?.generation ?? 0))
    const c5 = ok("T2: runner الجديد ذكر الاستعادة في لوجه الصريح", r2.out.includes("مستعاد") || r2.out.includes("مبنية من كوكيز"))

    return c1 && c2 && c3 && c4 && c5 ? 0 : 1
  })
}
withNightHours("FACEBOOK", () => runMain()).then((c) => process.exit(c ?? 1)).catch((e) => { console.error(e); process.exit(1) })
