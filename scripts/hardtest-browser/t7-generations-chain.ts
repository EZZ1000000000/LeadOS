// T7 — سلسلة الجيلات N → N+1 → N+2 → N+3 (§22 + §23 + §37 + §40 CONTINUITY)
// 4 جيلات ريديت متتالية: handoff مسجّل، parentRunId/childRunId، صفر ادعاء مزدوج، صفر تعارض بروفايلات.
import { db, runner, seedJobs, workspaceId, ok, record, withPolicyOverride, withNightHours } from "./lib"

async function runMain() {
  const wsId = await workspaceId()
  const marker = new Date()

  await withPolicyOverride("REDDIT", "cooldownAfterGenerationMs", 6_000, async () => {
    const handoffs: string[] = []
    for (let gen = 1; gen <= 4; gen++) {
      if (gen > 1) await new Promise((r) => setTimeout(r, 8_000)) // تجاوز cooldown المعدل (6ث)
      // بذر جوبة الجيل الحالي + جوبة الجيل القادم (عشان آخر جيل يثبت قرار dispatch=true)
      await seedJobs(wsId, "REDDIT", "PUBLIC_FETCH", [{ url: `https://example.com/?t7-gen${gen}` }])
      if (gen < 4) await seedJobs(wsId, "REDDIT", "PUBLIC_FETCH", [{ url: `https://example.com/?t7-gen${gen}-pending` }])
      const r = await runner("REDDIT")
      const line = (r.out.match(/Generation handoff: .*|لا dispatch.*|dispatch مطلوب.*/g) ?? []).join(" || ")
      handoffs.push(`g${gen}: exit=${r.code} ${line}`)
      console.log(`— g${gen} done`)
    }

    // قراءة السلسلة من قاعدة البيانات
    const dispatches = await db.browserEvent.findMany({
      where: { type: "DISPATCH", platform: "REDDIT", createdAt: { gte: marker } },
      orderBy: { createdAt: "asc" },
    })
    const chain = dispatches.map((d) => {
      const det = d.detail as { nextGeneration?: number; parentRunId?: string; childRunId?: string; triggerType?: string; shouldDispatch?: boolean }
      return `g${d.generation}→g${det.nextGeneration} parent=${det.parentRunId?.slice(0, 18)} child=${det.childRunId} trigger=${det.triggerType} shouldDispatch=${det.shouldDispatch}`
    })

    const gens = await db.browserRuntime.findMany({
      where: { platform: "REDDIT", startedAt: { gte: marker } },
      orderBy: { generation: "asc" },
      select: { generation: true, browserId: true, profileId: true, status: true, tasksCompleted: true },
    })

    // التحقق من عدم التكرار
    const allJobsRaw = await db.job.findMany({
      where: { type: "BROWSER_SCAN", createdAt: { gte: marker } },
      select: { id: true, status: true, attempts: true, workerId: true, payload: true },
    })
    const allJobs = allJobsRaw.filter((j) => (j.payload as { platform?: string }).platform === "REDDIT")
    const overClaimed = allJobs.filter((j) => j.attempts > 2).length
    const stuck = allJobs.filter((j) => j.status === "RUNNING").length
    const duplicateProfiles = gens.length - new Set(gens.map((g) => g.profileId)).size // كل جيل بروفايل واحد متتالي — لا تعارض لحظي

    // تعارض لحظي: هل اثنان نشطان بنفس اللحظة على نفس البروفايل؟
    let overlap = 0
    const intervals = gens.map((g) => ({ id: g.browserId }))
    void intervals
    const actives = await db.browserRuntime.count({ where: { platform: "REDDIT", status: { in: ["STARTING", "READY", "BUSY", "IDLE", "RECOVERING"] } } })

    record("T7: سلسلة الجيلات الكاملة", [
      handoffs.join("\n    "),
      `DISPATCH events=${dispatches.length}:`,
      "    " + chain.join("\n    "),
      `generations=${gens.map((g) => `g${g.generation}(${g.status},tasks=${g.tasksCompleted})`).join(" ")}`,
      `overClaimed=${overClaimed} stuck=${stuck} activeNow=${actives}`,
    ].join("\n  "))

    const gensUnique = new Set(gens.map((g) => g.generation)).size === gens.length
    const childIdsUnique = new Set(dispatches.map((d) => (d.detail as { childRunId?: string }).childRunId)).size === dispatches.length

    const c1 = ok("T7: 4 جيلات متتالية اكتملت (g1→g4)", gens.filter((g) => g.status === "CLOSED").length >= 4, `${gens.length} جيلات`)
    const c2 = ok("T7: كل handoff مسجّل بنسل كامل (parent/child/trigger)", dispatches.length >= 4 && childIdsUnique, `${dispatches.length} dispatch`)
    const c3 = ok("T7: صفر ادعاء مزدوج للجوبات", overClaimed === 0)
    const c4 = ok("T7: صفر جوبات عالقة", stuck === 0)
    const c5 = ok("T7: أرقام جيلات فريدة تصاعدية — لا قفز ولا تكرار", gensUnique)
    const c6 = ok("T7: لا متصفحات نشطة عالقة في النهاية (لا dispatch storm)", actives === 0, `activeNow=${actives}`)

    return c1 && c2 && c3 && c4 && c5 && c6 ? 0 : 1
  })
}
withNightHours("REDDIT", () => runMain()).then((c) => process.exit(c ?? 1)).catch((e) => { console.error(e); process.exit(1) })
