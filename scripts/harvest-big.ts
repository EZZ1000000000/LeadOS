import { harvestGitSkills, gitSkillsTactics } from "../src/lib/skills/gitskills"
async function main() {
  const res = await harvestGitSkills({ batches: 6 })
  console.log(res)
  const t = await gitSkillsTactics("REDDIT", "كافيهات محتاجة كاشير", 3)
  console.log("tactics REDDIT:", t.length, t.slice(0, 2))
  process.exit(0)
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1) })
