import { gitSkillsTactics } from "../src/lib/skills/gitskills"
async function main() {
  console.log("=== عامة ==="); console.log(await gitSkillsTactics("", "عملاء محتاجين خدمات رقمية", 3))
  console.log("=== LINKEDIN ==="); console.log(await gitSkillsTactics("LINKEDIN", "عملاء B2B", 3))
  process.exit(0)
}
main()
