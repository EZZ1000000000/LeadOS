// فحص توزيع الليدز على الـ workspaces + العضويات — لمعرفة ليه اللوحة تظهر فاضية
import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()

async function main() {
  console.log("== WORKSPACES ==")
  const ws = await db.workspace.findMany({ select: { id: true, name: true, slug: true, createdAt: true } })
  for (const w of ws) console.log(`- ${w.id} | ${w.name} | slug=${w.slug ?? "-"}`)

  console.log("== LEADS PER WORKSPACE ==")
  const byWs = await db.lead.groupBy({ by: ["workspaceId"], _count: { workspaceId: true } })
  for (const t of byWs) {
    const w = ws.find((x) => x.id === t.workspaceId)
    console.log(`- ${w?.name ?? t.workspaceId}: ${t._count.workspaceId} leads`)
  }

  console.log("== MEMBERSHIPS ==")
  const members = await db.workspaceMember.findMany({
    select: { workspaceId: true, userId: true, role: true },
  })
  const users = await db.user.findMany({ select: { id: true, email: true } })
  for (const m of members) {
    const u = users.find((x) => x.id === m.userId)
    const w = ws.find((x) => x.id === m.workspaceId)
    console.log(`- ${u?.email ?? m.userId} → ws="${w?.name ?? m.workspaceId}" (${m.role})`)
  }

  console.log("== RULES PER WORKSPACE ==")
  const rules = await db.searchRule.findMany({ select: { workspaceId: true, name: true, enabled: true } })
  for (const r of rules) {
    const w = ws.find((x) => x.id === r.workspaceId)
    console.log(`- [${r.enabled ? "ON" : "OFF"}] "${r.name}" → ws="${w?.name ?? r.workspaceId}"`)
  }

  console.log("== RECENT LEADS (أحدث 5) ==")
  const recent = await db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { workspaceId: true, createdAt: true, status: true } })
  for (const l of recent) {
    const w = ws.find((x) => x.id === l.workspaceId)
    console.log(`- ${l.createdAt.toISOString()} | ${l.status} | ws="${w?.name ?? l.workspaceId}"`)
  }

  await db.$disconnect()
}
main().catch((e) => { console.error("ERR:", e.message); process.exit(1) })
