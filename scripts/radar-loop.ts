// حلقة الرادار اللحظي — بتشتغل للأبد: مسح جروبات → ليدز فورية → تعليقات مجدولة بشرية
// تشغيل: bun run scripts/radar-loop.ts   (daemon عبر setsid)
import { radarCycle, RADAR_CONFIG } from "../src/lib/radar"

console.log(`⚡ الرادار اللحظي اشتغل — fresh=${RADAR_CONFIG.freshMinutes}د maxComments=${RADAR_CONFIG.maxComments} سقف/يوم=${RADAR_CONFIG.dailyCap} فاصل=${RADAR_CONFIG.commentMinGapMin}-${RADAR_CONFIG.commentMaxGapMin}د`)
console.log(`   واتساب: ${RADAR_CONFIG.whatsapp} | تليجرام: ${RADAR_CONFIG.telegram}`)

let cycle = 0
while (true) {
  cycle++
  const t0 = Date.now()
  try {
    const r = await radarCycle()
    const secs = ((Date.now() - t0) / 1000).toFixed(1)
    if (r.scanned || r.instant || r.leads || r.scheduled || r.commentNotes.length) {
      console.log(`[دورة ${cycle} | ${secs}s] جروبات=${r.scanned} لحظية=${r.instant} ليدز=${r.leads} مجدول=${r.scheduled}`)
      for (const n of r.commentNotes.slice(0, 4)) console.log(`   ${n}`)
    } else {
      console.log(`[دورة ${cycle} | ${secs}s] هادي — مفيش جديد`)
    }
  } catch (err) {
    console.error(`[دورة ${cycle}] خطأ: ${err instanceof Error ? err.message.slice(0, 160) : err}`)
  }
  // تنفس بين الدورات: 60-120 ثانية عشوائي — إيقاع بشري مش روبوتي
  const sleepMs = 60_000 + Math.random() * 60_000
  await new Promise((r) => setTimeout(r, sleepMs))
}
