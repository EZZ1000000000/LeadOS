// LeadOS — نبضة المودال (بديل Vercel Cron: بتشتغل من كونتينة المودال مباشرة على قاعدة Neon)
// كل نبضة: جدولة القواعد + الاكتشاف (بموجة المنصات الكاملة 16+) + مسح الجروبات المستحقة + التعليقات المستحقة
import { processTick } from "../src/lib/queue"
import { scanDueGroups } from "../src/lib/monitors/scan"
import { processDueComments } from "../src/lib/radar"
import { db } from "../src/lib/db"

const t0 = Date.now()
console.log("⏱ نبضة المودال بدأت...")

const out: string[] = []

// 1) التيك: جدولة + اكتشاف (موجة المنصات الكاملة شغالة جوه processDiscoveryJob)
try {
  const tick = await processTick(6)
  out.push(`tick: jobs=${tick.processed} rules=${tick.scheduledRules}`)
  for (const d of tick.details.slice(0, 8)) out.push(`  • ${d.slice(0, 150)}`)
} catch (err) {
  out.push(`tick error: ${err instanceof Error ? err.message.slice(0, 150) : err}`)
}

// 2) مسح الجروبات المستحقة (فيسبوك stealth/cookies + Apify rotation للعمومية)
try {
  const wsIds = await db.monitoredGroup.findMany({
    where: { status: { in: ["ACTIVE", "NEEDS_SESSION"] } },
    select: { workspaceId: true },
    distinct: ["workspaceId"],
    take: 2,
  })
  for (const w of wsIds) {
    const outcomes = await scanDueGroups(w.workspaceId, 2)
    for (const o of outcomes) out.push(`  group «${o.name}»: +${o.newPosts} جديد (${o.status})`)
  }
} catch (err) {
  out.push(`group scan error: ${err instanceof Error ? err.message.slice(0, 150) : err}`)
}

// 3) التعليقات المستحقة (محرك الـ8 قواعد — التوقيت البشري جوه الدالة)
try {
  const wsIds = await db.workspace.findMany({ where: { isActive: true }, select: { id: true }, take: 3 })
  for (const w of wsIds) {
    const r = await processDueComments(w.id, 2)
    if (r.done || r.deferred) out.push(`  comments ws=${w.id.slice(-6)}: done=${r.done} deferred=${r.deferred}`)
  }
} catch (err) {
  out.push(`comments error: ${err instanceof Error ? err.message.slice(0, 150) : err}`)
}

console.log(`✅ خلصت في ${((Date.now() - t0) / 1000).toFixed(1)}s`)
for (const line of out) console.log(line)
process.exit(0)
