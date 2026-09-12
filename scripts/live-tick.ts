// tick حي واحد: جدولة القواعد + معالجة الطابور + اكتشاف فعلي
import { processTick } from "../src/lib/queue"

const t0 = Date.now()
console.log("⏱ بدء التكة الحية...")
const result = await processTick(10)
console.log(`✅ خلصت في ${((Date.now() - t0) / 1000).toFixed(1)}s`)
console.log(`   مهام معالجة: ${result.processed}`)
console.log(`   قواعد مجدولة: ${result.scheduledRules}`)
for (const d of result.details.slice(0, 12)) console.log(`   • ${d.slice(0, 130)}`)
process.exit(0)
