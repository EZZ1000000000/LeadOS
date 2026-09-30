import { db } from "../src/lib/db"
import { buildSkillGraph, graphPlatformPriorities } from "../src/lib/skills/graph"
async function main() {
  // ورشة اختبار مؤقتة + إحصاء واقعي مصطنع
  const ws = await db.workspace.create({ data: { name: "test-graph-ws", slug: "test-graph-ws" } })
  const data: Array<[string, number, number, number]> = [
    ["FACEBOOK", 14, 5, 1.8], ["INSTAGRAM", 12, 3, 1.5], ["REDDIT", 8, 2, 1.4],
    ["DIRECTORY", 6, 4, 1.9], ["GOOGLE_MAPS", 20, 8, 2.2], ["QUORA", 3, 0, 0.9],
    ["DISCORD", 2, 0, 0.85], ["TELEGRAM", 4, 0, 0.95],
  ]
  for (const [platform, runs, leads, weight] of data) {
    await db.skillStat.create({ data: { workspaceId: ws.id, platform, runs, leads, weight } })
  }
  const g = await buildSkillGraph(ws.id)
  const plat = g.nodes.filter((n) => n.kind === "platform")
  const git = g.nodes.filter((n) => n.kind === "git")
  const kinds: Record<string, number> = {}
  for (const l of g.links) kinds[l.kind] = (kinds[l.kind] ?? 0) + 1
  console.log(`nodes=${g.nodes.length} (platform=${plat.length}, git=${git.length}) links=${g.links.length}`, kinds)
  const pri = await graphPlatformPriorities(ws.id, "كافيهات مدينة نصر محتاجة كاشير")
  const sorted = Object.entries(pri).sort((a, b) => b[1] - a[1])
  console.log("أولويات الجراف:")
  for (const [p, s] of sorted.slice(0, 8)) console.log(`  ${p}: ${s}`)
  // تنظيف
  await db.skillStat.deleteMany({ where: { workspaceId: ws.id } })
  await db.workspace.delete({ where: { id: ws.id } })
  console.log("تنظيف تم")
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
