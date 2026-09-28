// LeadOS — سجل المهارات (Skill Registry)
// المصدر: skills/discovery/<dir>/SKILL.md — بصيغة متوافقة مع Anthropic Agent Skills
// (frontmatter: name/description/platform). المحتوى متولّد داخل الباندل عن طريق
// scripts/gen-skills-manifest.ts (بيشتغل في كل build) — فمفيش قراءة fs وقت التشغيل على Vercel.
// عايز مهارة جديدة؟ اعمل فولدر جديد وحط فيه SKILL.md بنفس الصيغة — يتكشّف تلقائيًا.
import { SKILL_FILES } from "./manifest.generated"

export interface SkillMeta {
  platform: string
  name: string
  description: string
  body: string
  path: string
}

/** فصل الـfrontmatter (--- key: value ---) عن الجسم */
function parseSkill(raw: string): { fm: Record<string, string>; body: string } {
  const fm: Record<string, string> = {}
  let body = raw
  if (raw.startsWith("---")) {
    const end = raw.indexOf("---", 3)
    if (end > 0) {
      const head = raw.slice(3, end)
      body = raw.slice(end + 3).trim()
      for (const line of head.split("\n")) {
        const m = line.match(/^(\w[\w-]*):\s*(.+)$/)
        if (m) fm[m[1].trim()] = m[2].trim()
      }
    }
  }
  return { fm, body }
}

function loadSkills(): SkillMeta[] {
  const out: SkillMeta[] = []
  for (const f of SKILL_FILES) {
    const { fm, body } = parseSkill(f.content)
    const platform = (fm.platform || "").toUpperCase()
    if (!platform) continue
    out.push({
      platform,
      name: fm.name || platform.toLowerCase(),
      description: fm.description || "",
      body,
      path: f.path,
    })
  }
  return out.sort((a, b) => a.platform.localeCompare(b.platform))
}

export const SKILLS: SkillMeta[] = loadSkills()

export const SKILL_BY_PLATFORM: Record<string, SkillMeta> = Object.fromEntries(
  SKILLS.map((s) => [s.platform, s]),
)

/** كتالوج مختصر للـAI selector — اسم + وصف + أرقام الأداء (progressive disclosure) */
export function skillCatalogLines(stats?: Record<string, { leads: number; runs: number; weight: number }>): string[] {
  return SKILLS.map((s) => {
    const st = stats?.[s.platform]
    const perf = st ? ` (leads=${st.leads}/runs=${st.runs} وزن=${st.weight.toFixed(2)})` : ""
    return `- ${s.platform}: ${s.description.slice(0, 140)}${perf}`
  })
}
