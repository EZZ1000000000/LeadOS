// LeadOS — اختبار حي شامل للراوتر الجديد: كل قدرة على موديلها
// تشغيل: bun run scripts/test-router-live.ts
import { aiChat, aiEmbed, cosineSim, aiVision, aiTranslate, aiModerate, aiProviderStatus } from "../src/lib/ai"
import { saveSearchMemory, lookupSearchMemory } from "../src/lib/agent/memory"

const WS = process.env.LEADOS_WS_ID || ""

async function main() {
  const status = aiProviderStatus()
  console.log("═══ 1) جدول التوجيه ═══")
  console.log(`nvidia: ${status.nvidia} | مهام: ${Object.keys(status.tasks).length} | كتالوج: ${status.catalog.length}`)
  for (const [task, info] of Object.entries(status.tasks)) {
    console.log(`  ${task.padEnd(10)} → ${info.model}`)
  }

  console.log("\n═══ 2) إيمبدنج + تشابه دلالي ═══")
  const emb = await aiEmbed(["مطعم محتاج نظام كروت خصم", "عيادة أسنان تبحث عن مرضى"])
  if (emb) {
    console.log(`✓ model=${emb.model} dim=${emb.dim} latency=${emb.latencyMs}ms`)
    const sim = cosineSim(emb.vectors[0], emb.vectors[1])
    console.log(`  التشابه بين الجملتين المختلفتين: ${sim.toFixed(3)} (المفروض منخفض <0.5)`)
    const emb2 = await aiEmbed(["كافيه عايز كاشير ونظام خصومات"])
    if (emb2) {
      const sim2 = cosineSim(emb.vectors[0], emb2.vectors[0])
      console.log(`  التشابه بين «كروت خصم مطعم» و«كاشير وخصومات كافيه»: ${sim2.toFixed(3)} (المفروض عالي >0.6)`)
    }
  } else console.log("✗ الإيمبدنج فشل")

  console.log("\n═══ 3) ذاكرة دلالية (حفظ → بحث بصياغة مختلفة تمامًا) ═══")
  if (WS) {
    await saveSearchMemory(WS, {
      query: "جيمات في الشيخ زايد محتاجين نظام حجز أونلاين",
      platform: "GOOGLE_MAPS", resultCount: 18, leadCount: 14, avgScore: 65, bestScore: 82,
    })
    // بحث بصياغة مختلفة معنويًا لكن لا كلمة مشتركة تقريبًا
    const hits = await lookupSearchMemory(WS, "أندرة رياضية بمدينة الشيخ زايد تبحث عن برنامج حجز مواعيد")
    const best = hits.sort((a, b) => b.similarity - a.similarity)[0]
    console.log(best ? `✓ لقيت «${best.query}» بتشابه ${best.similarity} (جودة ${best.qualityScore})` : "✗ الذاكرة الدلالية مالقيتش")
  } else console.log("(تخطي — LEADOS_WS_ID مش مضبوط)")

  console.log("\n═══ 4) رؤية (صورة مضمونة) ═══")
  const v = await aiVision("ماذا ترى في الصورة؟ جملة واحدة.", "https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png")
  console.log(v ? `✓ ${v.model} ${v.latencyMs}ms — «${v.text.slice(0, 80)}»` : "✗ الرؤية فشلت")

  console.log("\n═══ 5) ترجمة ═══")
  const t = await aiTranslate("صباح الخير، عايز أعرف تفاصيل نظام الكروت والأسعار", "English")
  console.log(t ? `✓ ${t.model} ${t.latencyMs}ms — «${t.text.slice(0, 80)}»` : "✗ الترجمة فشلت")

  console.log("\n═══ 6) فحص السلامة ═══")
  const m1 = await aiModerate("نظام كروت خصم للمطاعم — اشترك دلوقتي وخد شهر مجاني")
  const m2 = await aiModerate("ابعتلي الفلوس دلوقتي أو هدربك — ده تهديد صريح")
  console.log(`✓ عادي: safe=${m1?.safe} | تهديد: safe=${m2?.safe} (المفروض true/false)`)

  console.log("\n═══ 7) تصنيف JSON (المهمة الأساسية) ═══")
  const c = await aiChat([
    { role: "system", content: "صنّف المنشور وردّ JSON فقط: {\"segment\":\"CARDS|AGENCY|BOTH\",\"score\":0-100,\"reason\":\"سطر\"}" },
    { role: "user", content: "المنشور: «محتاج كاشير لمطعم في مدينة نصر + عايز نظام كروت خصم»" },
  ], { task: "classify" })
  console.log(c ? `✓ ${c.model} ${c.latencyMs}ms — ${c.text.slice(0, 120).replace(/\n/g, " ")}` : "✗ التصنيف فشل")

  console.log("\n═══ 8) تحليل مستندات ═══")
  console.log("(nemotron-parse-2.0 اتسحب من المهام — غير مستقر في الـAPI المجاني 500 — موثق تجريبي في الكتالوج)")

  console.log("\n═══ اكتمل الفحص ═══")
}

main().catch((e) => { console.error(e); process.exit(1) })
