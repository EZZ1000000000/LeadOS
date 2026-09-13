// LeadOS — Run REAL discovery across all active rules/platforms.
// Enqueues one DISCOVERY job per enabled rule, then drives processTick()
// with rate-limit-friendly gaps until the queue drains or budget ends.
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

// Import the app's queue directly (bun resolves the "@/lib" paths via tsconfig).
async function drain() {
  const queue = await import("../src/lib/queue")
  return queue.processTick
}

async function main() {
  const ws = await db.workspace.findFirst()
  if (!ws) throw new Error("workspace missing")
  const wsId = ws.id

  const rules = await db.searchRule.findMany({ where: { enabled: true }, orderBy: { priority: "desc" } })
  console.log(`Enqueueing REAL discovery jobs for ${rules.length} rules...`)
  let delay = 0
  for (const rule of rules) {
    await db.job.create({
      data: {
        workspaceId: wsId,
        type: "DISCOVERY",
        payload: { ruleId: rule.id, sourceTypes: JSON.parse(JSON.stringify(rule.sourceTypes ?? [])) },
        priority: 70,
        scheduledAt: new Date(Date.now() + delay),
      },
    })
    delay += 5000 // stagger jobs so upstream search rate-limit cools down
    console.log(`  queued: ${rule.name} (platforms: ${JSON.stringify(rule.sourceTypes)})`)
  }

  const processTick = await drain()
  const started = Date.now()
  const BUDGET_MS = 7 * 60 * 1000 // 7 minutes max
  let tick = 0
  let totalProcessed = 0

  console.log(`\nDraining queue (budget ${BUDGET_MS / 60000} min)...`)
  while (Date.now() - started < BUDGET_MS) {
    tick++
    const pending = await db.job.count({ where: { status: { in: ["QUEUED", "RETRYING"] } } })
    if (pending === 0) break
    const result = await processTick(3) // small batches → gentle on search API
    totalProcessed += result.processed
    console.log(`tick #${tick}: processed=${result.processed} remaining=${pending - result.processed}`)
    for (const d of result.details) console.log(`   → ${d}`)
    if (result.processed === 0) await new Promise((r) => setTimeout(r, 10000))
    else await new Promise((r) => setTimeout(r, 6000))
  }

  // ---- Summary ----
  const [leads, bySource, contents, research] = await Promise.all([
    db.lead.count({ where: { workspaceId: wsId } }),
    db.leadSource.groupBy({ by: ["sourceType"], _count: { _all: true } }),
    db.contentItem.count({ where: { workspaceId: wsId } }),
    db.researchRun.count({ where: { workspaceId: wsId } }),
  ])
  console.log(`\n===== REAL DISCOVERY SUMMARY =====`)
  console.log(`content items collected: ${contents}`)
  console.log(`leads created: ${leads}`)
  console.log(`deep research runs: ${research}`)
  for (const g of bySource) console.log(`  platform ${g.sourceType}: ${g._count._all} leads`)
  console.log(`jobs processed in this run: ${totalProcessed}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
