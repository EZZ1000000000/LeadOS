import { buildSkillGraph, graphPlatformPriorities } from "../src/lib/skills/graph"
async function main() {
  const ws = (await (await import("../src/lib/db")).db.workspace.findFirst({ select: { id: true } }))!
  console.log("workspace:", ws.id)
  const g = await buildSkillGraph(ws.id)
  const platNodes = g.nodes.filter((n) => n.kind === "platform")
  const gitNodes = g.nodes.filter((n) => n.kind === "git")
  console.log(`nodes: ${g.nodes.length} (platform ${platNodes.length} + git ${gitNodes.length}) | links: ${g.links.length}`)
  const kinds = { tactic: 0, couse: 0, belongs: 0 } as Record<string, number>
  for (const l of g.links) kinds[l.kind] = (kinds[l.kind] ?? 0) + 1
  console.log("links by kind:", kinds)
  const pri = await graphPlatformPriorities(ws.id, "كافيهات مدينة نصر محتاجة كاشير")
  const sorted = Object.entries(pri).sort((a, b) => b[1] - a[1])
  console.log("\nأولويات الجراف للنيش «كافيهات...كاشير»:")
  for (const [p, s] of sorted.slice(0, 8)) console.log(`  ${p}: ${s}`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
