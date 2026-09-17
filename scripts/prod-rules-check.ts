// Task 19 — قواعد الاستهداف النشطة: sourceTypes بتاعتها
import { PrismaClient } from "@prisma/client"
const url = (await import("fs")).readFileSync("/tmp/neon_url", "utf8").trim()
const db = new PrismaClient({ datasources: { db: { url } } })
try {
  const rules = await db.searchRule.findMany({
    where: { enabled: true },
    select: { id: true, name: true, workspaceId: true, sourceTypes: true, keywords: true, services: true, scheduleCron: true },
  })
  console.log("القواعد النشطة:", rules.length)
  for (const r of rules) {
    console.log(`\n• ${r.name} (ws=${r.workspaceId.slice(-6)})`)
    console.log("  sourceTypes:", JSON.stringify(r.sourceTypes))
    console.log("  keywords:", JSON.stringify(r.keywords).slice(0, 150))
    console.log("  services:", JSON.stringify(r.services).slice(0, 120))
  }
} finally { await db.$disconnect() }
