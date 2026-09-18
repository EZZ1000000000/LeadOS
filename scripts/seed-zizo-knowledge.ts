// سَمّ المعرفة السوقية في ذاكرة كل ورشات LeadOS
// زيزو والكيان يبدأوا من خبرة جاهزة — مش من الصفر
import { db } from "../src/lib/db"
import { seedWorkspaceKnowledge } from "../src/lib/agent/zizo/knowledge"

async function main() {
  const workspaces = await db.workspace.findMany({ select: { id: true, name: true } })
  console.log(`📂 ${workspaces.length} ورشة عمل\n`)
  let total = 0
  for (const ws of workspaces) {
    const n = await seedWorkspaceKnowledge(ws.id)
    total += n
    console.log(`  ${n ? "📚" : "✓"} ${ws.name}: ${n} معرفة جديدة${n ? "" : " (متعلّمة قبل كده)"}`)
  }
  console.log(`\n✅ إجمالي المعرفة المسَمَّة: ${total}`)
  // عينة تحقق
  const sample = await db.agentInsight.groupBy({ by: ["kind"], where: { workspaceId: workspaces[0]?.id }, _count: true })
  console.log("تحليل أنواع الذاكرة (أول ورشة):", sample.map((s) => `${s.kind}=${s._count}`).join(" • "))
  await db.$disconnect()
}

main().catch((e) => {
  console.error("فشل السَمّ:", e)
  process.exit(1)
})
