// سَمّ المعرفة السوقية في ذاكرة كل ورشات LeadOS
// زيزو والكيان يبدأوا من خبرة جاهزة — مش من الصفر
import { db } from "../src/lib/db"
import { seedWorkspaceKnowledge } from "../src/lib/agent/zizo/knowledge"
import { seedExpertiseKnowledge } from "../src/lib/agent/zizo/expertise"

async function main() {
  const workspaces = await db.workspace.findMany({ select: { id: true, name: true } })
  console.log(`📂 ${workspaces.length} ورشة عمل\n`)
  let total = 0
  for (const ws of workspaces) {
    const n = await seedWorkspaceKnowledge(ws.id)
    const e = await seedExpertiseKnowledge(ws.id) // خبرة البيع: 17 playbook + إحصائيات + أسعار مصر + إغلاقات
    total += n + e
    console.log(`  ${n + e ? "📚" : "✓"} ${ws.name}: ${n} سوقية + ${e} خبرة بيع${n + e ? "" : " (متعلّمة قبل كده)"}`)
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
