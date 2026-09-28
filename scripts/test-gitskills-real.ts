// اختبار حصاد GitSkills الحقيقي (الوحدة الفعلية) على قاعدة Dev المحلية
import { harvestGitSkills, gitSkillsTactics } from "../src/lib/skills/gitskills"

async function main() {
  console.log("=== حصاد حقيقي على Dev DB ===")
  const res = await harvestGitSkills()
  console.log(res)
  console.log("\n=== تكتيكات لمنصة REDDIT ===")
  const t = await gitSkillsTactics("REDDIT", "كافيهات محتاجة كاشير", 3)
  console.log(t)
  console.log("\n=== تكتيكات عامة (للمنتقي) ===")
  const g = await gitSkillsTactics("", "عملاء محتاجين خدمات رقمية في مصر", 3)
  console.log(g)
  process.exit(0)
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1) })
