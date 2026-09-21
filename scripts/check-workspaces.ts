// LeadOS — فحص الورشات + عينة من ذاكرة زيزو المدربة
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  const ws = await db.workspace.findMany({ select: { id: true, name: true, slug: true, createdAt: true } })
  console.log("=== الورشات ===")
  ws.forEach((w) => console.log(`${w.name} (${w.slug}) — ${w.createdAt.toISOString().slice(0, 16)}`))

  const ins = await db.agentInsight.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { kind: true, pattern: true, note: true } })
  console.log("\n=== آخر الـInsights ===")
  ins.forEach((i) => console.log(`[${i.kind}] ${i.pattern.slice(0, 60)} — ${i.note.slice(0, 60)}`))

  // أنواع الـInsights (توزيع التدريب)
  const kinds = await db.agentInsight.groupBy({ by: ["kind"], _count: true })
  console.log("\n=== توزيع الذاكرة ===")
  kinds.forEach((k) => console.log(`${k.kind}: ${k._count}`))

  await db.$disconnect()
}

main()
