// LeadOS — حالة عقل المهارات (SkillStat + SkillLesson + كتالوج SKILL.md + خريطة المهارات + GitSkills)
import { db } from "@/lib/db"
import { json, requireAuth, isResponse } from "@/lib/api-helpers"
import { SKILLS } from "@/lib/skills/registry"
import { aiProviderStatus } from "@/lib/ai"
import { buildSkillGraph } from "@/lib/skills/graph"

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const wsId = auth.workspace.id

  const [stats, lessons, recentSearchJobs, graph, gitTop, gitAgg] = await Promise.all([
    db.skillStat.findMany({ where: { workspaceId: wsId }, orderBy: { weight: "desc" } }),
    db.skillLesson.findMany({
      where: { workspaceId: wsId },
      orderBy: [{ quality: "desc" }, { createdAt: "desc" }],
      take: 12,
    }),
    db.searchJob.findMany({
      where: { source: { workspaceId: wsId } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { metadata: true, createdAt: true },
    }),
    buildSkillGraph(wsId).catch(() => ({ nodes: [], links: [], builtAt: null })),
    db.gitSkill.findMany({ orderBy: [{ weight: "desc" }, { relevance: "desc" }], take: 8 }),
    db.gitSkill.aggregate({ _count: { id: true }, _max: { createdAt: true } }).catch(() => null),
  ])

  // آخر قرار انتخاب من ميتاداتا الجوبات (weights ولا ai-selector)
  const lastSelection =
    recentSearchJobs
      .map((j) => {
        const m = (j.metadata ?? {}) as { selectedBy?: string; aiSmithTarget?: string; byType?: Record<string, number> }
        return { selectedBy: m.selectedBy ?? null, aiSmithTarget: m.aiSmithTarget ?? null, byType: m.byType ?? null, at: j.createdAt }
      })
      .find((s) => s.selectedBy) ?? null

  const statByPlatform = Object.fromEntries(stats.map((s) => [s.platform, s]))
  const skills = SKILLS.map((s) => {
    const st = statByPlatform[s.platform]
    return {
      platform: s.platform,
      name: s.name,
      description: s.description,
      runs: st?.runs ?? 0,
      results: st?.results ?? 0,
      leads: st?.leads ?? 0,
      wins: st?.wins ?? 0,
      weight: st?.weight ?? 1.0,
      lastLeadAt: st?.lastLeadAt ?? null,
    }
  }).sort((a, b) => b.weight - a.weight)

  const ai = aiProviderStatus()
  return json({
    skills,
    lessons: lessons.map((l) => ({
      id: l.id,
      platform: l.platform,
      query: l.query,
      leads: l.leads,
      quality: l.quality,
      source: l.source,
      createdAt: l.createdAt,
    })),
    lastSelection,
    // خريطة المهارات (skill-map): عقد ووصلات حية من الاستخدام الحقيقي
    graph,
    // مكتبة GitSkills العالمية (3.8M مهارة — المحصود منها هنا)
    git: {
      total: gitAgg?._count.id ?? 0,
      lastHarvestAt: gitAgg?._max.createdAt ?? null,
      top: gitTop.map((g) => ({
        name: g.name,
        repo: g.repo,
        description: g.description.slice(0, 160),
        tags: g.tags,
        relevance: g.relevance,
        weight: g.weight,
        useCount: g.useCount,
        leadCount: g.leadCount,
      })),
    },
    ai: {
      dahl: ai.dahl.active,
      nvidia: ai.hasKey,
      note: ai.note,
    },
  })
}
