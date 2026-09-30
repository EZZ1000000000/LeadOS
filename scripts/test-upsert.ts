import { db } from "../src/lib/db"
async function main() {
  try {
    const r = await db.gitSkill.upsert({
      where: { repo_path: { repo: "test/repo", path: "skills/test/SKILL.md" } },
      create: { repo: "test/repo", path: "skills/test/SKILL.md", name: "test-skill", description: "desc here", body: "body", tags: "test", relevance: 40 },
      update: { relevance: { set: 40 } },
    })
    console.log("UPSERT OK:", r.id, r.name)
    const all = await db.gitSkill.findMany()
    console.log("total rows:", all.length)
    await db.gitSkill.delete({ where: { id: r.id } })
    console.log("cleanup done")
  } catch (e) { console.error("UPSERT FAILED:", e instanceof Error ? e.message : e) }
  process.exit(0)
}
main()
