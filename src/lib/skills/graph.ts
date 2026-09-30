// LeadOS — خريطة المهارات (دمج فكرة skill-map: الـskills كجراف مرتبط بالمهام)
// جراف حي من بيانات الاستخدام الحقيقية:
//   عقد (nodes): مهارات المنصات (SKILL.md ×19) + مهارات GitSkills المحصودة
//   وصلات (links):
//     belongs — مهارة منصة ⇄ منصتها (من الـfrontmatter)
//     tactic  — مهارة GitSkills ⇄ منصة (من الوسوم/الوصف)
//     couse   — منصة ⇄ منصة (اتستخدموا في نفس الجوب — من metadata آخر 7 أيام)
//   أوزان الوصلات من SkillStat (ليدز/جوبات) — الجراف نفسه بيقرر مين يدخل الموجة.
// الفرق عن الـAI selector: الجراف حتمي وسريع ومش بيوقع — بيشتغل كل نبضة كأساس،
// والـAI بيبني فوقه (إعادة ترتيب للمرشحين بس).
import { db } from "@/lib/db"
import { SKILLS } from "./registry"

export interface SkillGraphNode {
  id: string
  kind: "platform" | "git"
  label: string
  platform?: string // لعقد المنصات
  weight: number
  leads: number
  runs: number
  tags?: string
}

export interface SkillGraphLink {
  source: string // id عقدة
  target: string // id عقدة
  kind: "belongs" | "tactic" | "couse"
  weight: number
}

export interface SkillGraph {
  nodes: SkillGraphNode[]
  links: SkillGraphLink[]
  builtAt: string
}

const COUSE_WINDOW_HOURS = 24 * 7
const COUSE_MAX_LINKS = 40
const GIT_NODES_MAX = 24

/** بناء الجراف الكامل لورشة (بيتخزن مفيش — حسابه رخيص من جداول موجودة) */
export async function buildSkillGraph(wsId: string): Promise<SkillGraph> {
  const [stats, gitSkills, recentJobs] = await Promise.all([
    db.skillStat.findMany({ where: { workspaceId: wsId } }),
    db.gitSkill.findMany({ orderBy: [{ weight: "desc" }, { relevance: "desc" }], take: GIT_NODES_MAX }),
    db.searchJob.findMany({
      where: { source: { workspaceId: wsId }, createdAt: { gte: new Date(Date.now() - COUSE_WINDOW_HOURS * 3_600_000) } },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { metadata: true },
    }),
  ])

  const statByPlatform = new Map(stats.map((s) => [s.platform, s]))
  const nodes: SkillGraphNode[] = []
  const links: SkillGraphLink[] = []

  // 1) عقد المنصات = مهارات SKILL.md المدمجة
  for (const s of SKILLS) {
    const st = statByPlatform.get(s.platform)
    nodes.push({
      id: `platform:${s.platform}`,
      kind: "platform",
      label: s.platform,
      platform: s.platform,
      weight: st?.weight ?? 1,
      leads: st?.leads ?? 0,
      runs: st?.runs ?? 0,
    })
  }

  // 2) عقد GitSkills + وصلات tactic للمنصات (من الوسوم)
  const PLATFORM_KEYS = new Set(SKILLS.map((s) => s.platform))
  for (const g of gitSkills) {
    const id = `git:${g.id}`
    nodes.push({ id, kind: "git", label: g.name, weight: g.weight, leads: g.leadCount, runs: g.useCount, tags: g.tags })
    const tags = g.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
    const hay = `${g.name} ${g.description} ${g.tags}`.toLowerCase()
    for (const p of PLATFORM_KEYS) {
      const pl = p.toLowerCase()
      // الصلة: وسم صريح بالمنصة أو ذكرها في الاسم/الوصف
      const hit = tags.includes(pl) || hay.includes(pl)
      if (!hit) continue
      const st = statByPlatform.get(p)
      // وزن الوصلة: صلة المهارة × وزن المنصة المتعلم
      links.push({ source: id, target: `platform:${p}`, kind: "tactic", weight: Math.min(3, g.relevance / 20) * (st?.weight ?? 1) })
    }
  }

  // 3) وصلات co-use بين المنصات: اتنين اشتغلوا في نفس الجوب = شركاء صيد
  const pairCount = new Map<string, number>()
  for (const j of recentJobs) {
    const m = (j.metadata ?? {}) as { byType?: Record<string, number>; adaptersUsed?: string[] }
    const plats = new Set([
      ...Object.keys(m.byType ?? {}),
      ...(m.adaptersUsed ?? []).map((a) => a.replace(/^site:/, "").toUpperCase()),
    ].filter((p) => PLATFORM_KEYS.has(p)))
    const list = [...plats]
    for (let i = 0; i < list.length; i++) {
      for (let k = i + 1; k < list.length; k++) {
        const key = [list[i], list[k]].sort().join("~")
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1)
      }
    }
  }
  const pairEntries = [...pairCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, COUSE_MAX_LINKS)
  for (const [key, n] of pairEntries) {
    const [a, b] = key.split("~")
    links.push({ source: `platform:${a}`, target: `platform:${b}`, kind: "couse", weight: Math.min(3, n / 5) })
  }

  return { nodes, links, builtAt: new Date().toISOString() }
}

/**
 * أولويات الجراف للمنصات: بيمشي الجراف من وجهة نظر النيش.
 * score = وزن المنصة المتعلم × (1 + أفصل tactic مرتبط بيها × 0.3) × (1 + شركاء co-use المنتِجين × 0.12)
 * × (1 + صلة النيش من الدروس × 0.25) — حتمي، سريع، وبيشتغل كل نبضة حتى من غير AI.
 */
export async function graphPlatformPriorities(wsId: string, niche: string): Promise<Record<string, number>> {
  try {
    const [graph, lessons] = await Promise.all([
      buildSkillGraph(wsId),
      db.skillLesson.findMany({
        where: { workspaceId: wsId, leads: { gte: 1 } },
        orderBy: { quality: "desc" },
        take: 30,
        select: { platform: true, query: true, niche: true },
      }),
    ])
    const nicheTokens = niche.toLowerCase().split(/\s+/).filter((w) => w.length >= 4)

    // صلة النيش لكل منصة: دروس المنصة اللي كلماتها بتلمس النيش
    const nicheAffinity: Record<string, number> = {}
    for (const l of lessons) {
      const hay = `${l.query} ${l.niche ?? ""}`.toLowerCase()
      const hits = nicheTokens.filter((t) => hay.includes(t)).length
      if (hits > 0) nicheAffinity[l.platform] = (nicheAffinity[l.platform] ?? 0) + hits
    }

    // تجميع الوصلات لكل منصة
    const tacticBoost: Record<string, number> = {}
    const couseBoost: Record<string, number> = {}
    for (const link of graph.links) {
      if (link.kind === "tactic") {
        const p = link.target.replace("platform:", "")
        tacticBoost[p] = Math.max(tacticBoost[p] ?? 0, link.weight)
      } else if (link.kind === "couse") {
        const a = link.source.replace("platform:", "")
        const b = link.target.replace("platform:", "")
        // الشريك المنتِج هو اللي بيرفع — منصة صامتة مبتسرقش وزن شريكتها
        const otherLeads = (p: string) => graph.nodes.find((n) => n.id === `platform:${p}`)?.leads ?? 0
        const w = link.weight
        if (otherLeads(b) > 0) couseBoost[a] = (couseBoost[a] ?? 0) + w * 0.12
        if (otherLeads(a) > 0) couseBoost[b] = (couseBoost[b] ?? 0) + w * 0.12
      }
    }

    const out: Record<string, number> = {}
    for (const node of graph.nodes) {
      if (node.kind !== "platform" || !node.platform) continue
      const score =
        node.weight *
        (1 + Math.min(1.5, tacticBoost[node.platform] ?? 0) * 0.3) *
        (1 + Math.min(1.2, couseBoost[node.platform] ?? 0)) *
        (1 + Math.min(2, nicheAffinity[node.platform] ?? 0) * 0.25)
      out[node.platform] = Math.round(score * 100) / 100
    }
    return out
  } catch {
    return {}
  }
}
