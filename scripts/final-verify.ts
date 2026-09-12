/**
 * التحقق النهائي — ليدز فرش من كل مصدر + عينات حقيقية + صحة النظام قبل الرفع
 */
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  console.log("═══ LEADS PER SOURCE ═══")
  const sources = await db.source.findMany()
  const coverage: Array<{ type: string; leads: number }> = []
  for (const s of sources) {
    const leads = await db.lead.count({ where: { contentLinks: { some: { content: { sourceId: s.id } } } } })
    coverage.push({ type: s.type, leads })
  }
  coverage.sort((a, b) => b.leads - a.leads)
  for (const c of coverage) console.log(`${c.type.padEnd(14)} ${String(c.leads).padStart(3)} ${c.leads > 0 ? "✓" : "✗"}`)
  const withLeads = coverage.filter((c) => c.leads > 0).length

  const total = await db.lead.count()
  const last24 = await db.lead.count({ where: { createdAt: { gte: new Date(Date.now() - 6 * 3600 * 1000) } } })
  const hot = await db.lead.count({ where: { score: { gte: 70 } } })
  const researched = await db.researchRun.count({ where: { status: "COMPLETED" } })
  console.log(`\nTOTAL=${total} | fresh(last 6h)=${last24} | hot(score>=70)=${hot} | researchCompleted=${researched}`)
  console.log(`SOURCES WITH LEADS: ${withLeads}/${sources.length}`)

  console.log("\n═══ FRESH SAMPLES (newest per source) ═══")
  for (const s of sources) {
    if (["GOOGLE_MAPS"].includes(s.type)) continue
    const links = await db.leadContent.findMany({
      where: { content: { sourceId: s.id }, relationship: "primary" },
      orderBy: { createdAt: "desc" },
      take: 2,
      include: { lead: { include: { business: { select: { name: true, industry: true } } } }, content: { select: { canonicalUrl: true } } },
    })
    if (!links.length) continue
    console.log(`\n▪ ${s.type}:`)
    for (const l of links) {
      console.log(
        `  ${l.lead.business?.name?.slice(0, 45)} | score=${l.lead.score} | ${l.lead.business?.industry ?? "-"} | ${(l.content.canonicalUrl ?? "").slice(0, 55)}`,
      )
    }
  }

  // آخر SearchJob ناجح (دليل التشغيل الحي)
  const lastJobs = await db.searchJob.findMany({ orderBy: { startedAt: "desc" }, take: 3, select: { query: true, resultCount: true, completedAt: true } })
  console.log("\n═══ LAST SEARCH JOBS ═══")
  for (const j of lastJobs) console.log(`${j.completedAt?.toISOString().slice(0, 16)} results=${j.resultCount} q="${j.query?.slice(0, 50)}"`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
