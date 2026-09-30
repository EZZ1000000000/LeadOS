// إنقاذ ملفات skills/discovery/*/SKILL.md من المانيفست المولّد — عكس gen-skills-manifest
// (الملفات المصدرية ضاعت من الديسك والجيت — المحتوى ناجي جوه manifest.generated.ts)
import { mkdirSync, writeFileSync } from "fs"
import { join, dirname } from "path"

const manifestPath = join(process.cwd(), "src/lib/skills/manifest.generated.ts")
const raw = await import(manifestPath)
const files = raw.SKILL_FILES
if (!files?.length) {
  console.error("MANIFEST EMPTY — مفيش حاجة تتنقذ!")
  process.exit(1)
}
for (const f of files) {
  const out = join(process.cwd(), f.path)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, f.content, "utf8")
  console.log(`✓ ${f.path} (${f.content.length} bytes)`)
}
console.log(`rescued ${files.length} SKILL.md files`)
