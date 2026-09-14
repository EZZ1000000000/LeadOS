// فحص عميق: جودة ليدز ezz + تاريخ الإنشاء + آخر عمليات الأيجنت
import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()

async function main() {
  const ws = await db.workspace.findMany({ select: { id: true, name: true } })
  const ezz = ws.find((w) => w.name === "ezz")!
  const leados = ws.find((w) => w.name === "LeadOS")!

  console.log("== EZZ LEADS CREATED PER DAY ==")
  const ezzLeads = await db.lead.findMany({ where: { workspaceId: ezz.id }, orderBy: { createdAt: "asc" }, select: { createdAt: true } })
  const byDay = new Map<string, number>()
  for (const l of ezzLeads) {
    const k = l.createdAt.toISOString().slice(0, 10)
    byDay.set(k, (byDay.get(k) ?? 0) + 1)
  }
  for (const [k, v] of byDay) console.log(`- ${k}: ${v}`)

  console.log("== SAMPLE: أحدث 10 ليدز في ezz ==")
  const sample = await db.lead.findMany({
    where: { workspaceId: ezz.id }, orderBy: { createdAt: "desc" }, take: 10,
    select: { status: true, leadSourceType: true, serviceNeeds: true, business: { select: { name: true, industry: true, city: true, phone: true, rating: true, reviewCount: true, websiteUrl: true } } },
  })
  for (const l of sample) {
    const b = l.business
    console.log(`- ${b.name} | ${b.industry ?? "-"} | ${b.city ?? "-"} | tel=${b.phone ? "✓" : "✗"} | rating=${b.rating ?? "-"} (${b.reviewCount ?? 0}) | site=${b.websiteUrl ? "✓" : "✗"} | ${l.leadSourceType} | ${l.status}`)
  }

  console.log("== JOBS الأخيرة (ezz) ==")
  const jobs = await db.job.findMany({ where: { workspaceId: ezz.id }, orderBy: { createdAt: "desc" }, take: 6, select: { type: true, status: true, createdAt: true, result: true } })
  for (const j of jobs) console.log(`- ${j.type} ${j.status} @ ${j.createdAt.toISOString()} | ${JSON.stringify(j.result).slice(0, 140)}`)

  console.log("== SEARCH JOBS الأخيرة ==")
  const sj = await db.searchJob.findMany({ where: { workspaceId: ezz.id }, orderBy: { createdAt: "desc" }, take: 5, select: { query: true, status: true, resultCount: true, createdAt: true, metadata: true } })
  for (const s of sj) console.log(`- "${s.query}" → ${s.resultCount} نتيجة @ ${s.createdAt.toISOString()} | adapters=${JSON.stringify((s.metadata as { adaptersUsed?: string[] })?.adaptersUsed ?? [])}`)

  console.log("== LeadOS آخر 3 ==")
  const s2 = await db.lead.findMany({
    where: { workspaceId: leados.id }, orderBy: { createdAt: "desc" }, take: 3,
    select: { createdAt: true, business: { select: { name: true, industry: true, phone: true } } },
  })
  for (const l of s2) console.log(`- ${l.createdAt.toISOString()} | ${l.business.name} | ${l.business.industry ?? "-"} | tel=${l.business.phone ? "✓" : "✗"}`)

  await db.$disconnect()
}
main().catch((e) => { console.error("ERR:", e.message); process.exit(1) })
