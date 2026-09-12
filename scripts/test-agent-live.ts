/**
 * اختبار حي كامل للأيجنت الداخلي — 3 مراحل:
 * 1) هدف جديد → صيد من الويب/الخرائط + حفظ ذاكرة
 * 2) نفس الهدف تاني → رد من الذاكرة (صفر ويب) — دليل "سرش للسرش"
 * 3) أداة تصدير Excel + حالة الترسانة
 */
import { PrismaClient } from "@prisma/client"
import { runAgent } from "../src/lib/agent/loop"
import { AGENT_TOOLS, toolStatus } from "../src/lib/agent/tools"
import { lookupSearchMemory } from "../src/lib/agent/memory"

const db = new PrismaClient()

function printSteps(steps: Array<{ idx: number; tool: string; note: string; status: string; durationMs: number }>) {
  for (const s of steps) {
    const icon = s.status === "OK" ? "✓" : s.status === "SKIPPED" ? "⏭" : "✗"
    console.log(`   ${icon} [${s.tool}] ${s.note} (${s.durationMs}ms)`)
  }
}

async function main() {
  const ws = await db.workspace.findFirst()
  if (!ws) throw new Error("no workspace")
  const before = await db.lead.count()
  console.log(`# LEADS BEFORE=${before}\n`)

  // ═══ المرحلة 1: هدف جديد — صيد حقيقي ═══
  console.log("════ مرحلة 1: هدف جديد (صيد حي) ════")
  const r1 = await runAgent(ws.id, "عيادات أسنان في التجمع الخامس محتاجة نظام حجز", { exportCsv: true })
  console.log(`STATUS=${r1.status} | ${r1.summary}`)
  printSteps(r1.steps)
  const after1 = await db.lead.count()
  console.log(`LEADS=${after1} (+${after1 - before})\n`)

  // ═══ المرحلة 2: نفس الهدف — الذاكرة ═══
  console.log("════ مرحلة 2: نفس الهدف (سرش للسرش → رد من الذاكرة) ════")
  const memHits = await lookupSearchMemory(ws.id, "عايز عيادات اسنان في التجمع الخامس عايزة حجوزات", { minSimilarity: 0.3 })
  console.log(`فحص ذاكرة بصياغة مختلفة للهدف نفسه: ${memHits.length} إصابة — الأقوى: «${memHits[0]?.query ?? "-"}» جودة=${memHits[0]?.qualityScore ?? 0} تشابه=${memHits[0]?.similarity ?? 0}`)
  const r2 = await runAgent(ws.id, "عيادات أسنان في التجمع الخامس محتاجة نظام حجز")
  console.log(`STATUS=${r2.status} | ${r2.summary}`)
  printSteps(r2.steps)
  const after2 = await db.lead.count()
  console.log(`LEADS=${after2} (+${after2 - after1}) — الذاكرة ما ضافتش ويب جديد = ${after2 - after1 === 0 ? "صح ✓" : "لا!"}\n`)

  // ═══ المرحلة 3: الترسانة والتصدير ═══
  console.log("════ مرحلة 3: الترسانة ════")
  for (const t of toolStatus()) {
    console.log(`   ${t.ready ? "✓" : "⏳"} ${t.name}${t.needs.length ? ` (ينتظر: ${t.needs.join(",")})` : ""}`)
  }
  const exportTool = AGENT_TOOLS.find((t) => t.name === "export_leads_csv")!
  const exp = await exportTool.run({ workspace_id: ws.id, min_score: 50 })
  console.log(`   📦 ${exp.note}`)

  // عيّنة الليدز الجديدة
  const fresh = await db.lead.findMany({
    where: { workspaceId: ws.id, createdAt: { gte: new Date(Date.now() - 10 * 60000) } },
    include: { business: { select: { name: true, phone: true, websiteUrl: true, city: true, rating: true } } },
    orderBy: { createdAt: "desc" }, take: 6,
  })
  console.log("\n════ عيّنة الليدز الجديدة ════")
  for (const l of fresh) {
    console.log(`• ${l.business.name.slice(0, 40)} | سكور=${l.score} | تليفون=${l.business.phone ?? "-"} | تقييم=${l.business.rating ?? "-"} | ${l.business.websiteUrl?.slice(0, 40) ?? "-"}`)
  }
  process.exit(0)
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1) })
