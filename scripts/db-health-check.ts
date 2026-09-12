// فحص سلامة قاعدة البيانات الشامل: عدادات + مكررات + أيتام + بيانات ناقصة
import { db } from "../src/lib/db"

async function main() {
  console.log("═".repeat(60))
  console.log("🗄 فحص سلامة قاعدة البيانات")
  console.log("═".repeat(60))

  const counts = {
    workspaces: await db.workspace.count(),
    users: await db.user.count(),
    businesses: await db.business.count(),
    leads: await db.lead.count(),
    sources: await db.source.count(),
    discoveredItems: await db.contentItem.count(),
    agentRuns: await db.agentRun.count(),
    agentSteps: await db.agentStep.count(),
    searchMemory: await db.searchMemory.count(),
    agentInsights: await db.agentInsight.count(),
    tasks: await db.task.count(),
    jobs: await db.job.count(),
    chatSessions: await db.aiChatSession.count(),
  }
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`)

  // 1) مكررات الأعمال بنفس الاسم + المدينة
  const allBiz = await db.business.findMany({ select: { id: true, name: true, city: true } })
  const seen = new Map<string, number>()
  for (const b of allBiz) {
    const key = b.name.trim().toLowerCase() + "|" + (b.city ?? "")
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  const dupes = [...seen.entries()].filter(([, n]) => n > 1)
  console.log(`\n📌 مكررات أعمال (نفس الاسم+مدينة): ${dupes.length}`)
  for (const [k, n] of dupes.slice(0, 5)) console.log(`    ${k.slice(0, 50)} ×${n}`)

  // 2) ليدز بدون بيزنس (أيتام)
  const orphans = await db.lead.findMany({ where: { businessId: null }, select: { id: true } })
  console.log(`📌 ليدز يتيمة (بدون Business): ${orphans.length}`)

  // 3) ليدز ببيزنس محذوف (مرجع مكسور) — نفحص بالكلية
  const leadsWithBiz = await db.lead.findMany({ select: { businessId: true }, where: { businessId: { not: null } } })
  const bizIds = new Set(allBiz.map((b) => b.id))
  const broken = leadsWithBiz.filter((l) => !bizIds.has(l.businessId!)).length
  console.log(`📌 مراجع بيزنس مكسورة: ${broken}`)

  // 4) توزيع الليدز بالمصدر والحالة
  const bySource = await db.lead.groupBy({ by: ["leadSourceType"], _count: true })
  console.log("\n📊 التوزيع بالمصدر:")
  for (const s of bySource.sort((a, b) => b._count - a._count)) console.log(`    ${s.leadSourceType}: ${s._count}`)
  const byStatus = await db.lead.groupBy({ by: ["status"], _count: true })
  console.log("📊 التوزيع بالحالة: " + byStatus.map((s) => `${s.status}=${s._count}`).join(" | "))

  // 5) المهام في الطابور
  const taskStatus = await db.job.groupBy({ by: ["status"], _count: true }).catch(() => [] as Array<{ status: string; _count: number }>)
  if (taskStatus.length) console.log("📊 الطابور (Job): " + taskStatus.map((t) => `${t.status}=${t._count}`).join(" | "))

  // 6) مصادر النظام — مفعلة/متوقفة
  const sources = await db.source.findMany({ select: { type: true, status: true } })
  const active = sources.filter((s) => s.status === "ACTIVE").length
  console.log(`\n📌 المصادر: ${sources.length} (${active} مفعلة)`)
  const paused = sources.filter((s) => s.status !== "ACTIVE").map((s) => s.type)
  if (paused.length) console.log(`   موقوفة: ${paused.join(", ")}`)

  console.log("\n✅ الفحص خلص")
  process.exit(0)
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1) })
