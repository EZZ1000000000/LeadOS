// LeadOS — محرك التعلم للمهارات (Skill Learning Engine)
// كل جوب اكتشاف/ليد جديد بيحدّث وزن المنصة-مهارة — الوزن هو اللي بيقرر
// مين يتنادى في الموجة الجاية (selection bias للمنتِج وهدم لليتٍ ما بينتجش).
// ذاكرة الاستعلامات (SkillLesson): الاستعلام اللي جاب ليدز بيرجع أولًا — النظام بيشتغل لنفسه.
import { db } from "@/lib/db"

const clamp = (w: number) => Math.max(0.2, Math.min(5, w))

/** أوزان كل المهارات لورشة معينة (المفقود = 1.0) */
export async function skillWeights(wsId: string): Promise<Record<string, number>> {
  const rows = await db.skillStat.findMany({ where: { workspaceId: wsId }, select: { platform: true, weight: true } })
  return Object.fromEntries(rows.map((r) => [r.platform, r.weight]))
}

/** لقطة كاملة للإحصاء — للـAI selector (أرقام الأداء جوه البرومبت) */
export async function skillStatsSnapshot(
  wsId: string,
): Promise<Record<string, { leads: number; runs: number; weight: number }>> {
  const rows = await db.skillStat.findMany({
    where: { workspaceId: wsId },
    select: { platform: true, leads: true, runs: true, weight: true },
  })
  return Object.fromEntries(rows.map((r) => [r.platform, { leads: r.leads, runs: r.runs, weight: r.weight }]))
}

/** حصد عناصر (من غير تغيير وزن — النتيجة الحقيقية هي الليدز) */
export async function recordSkillResults(wsId: string, byType: Record<string, number>): Promise<void> {
  for (const [platform, n] of Object.entries(byType)) {
    if (!platform || !n) continue
    await db.skillStat
      .upsert({
        where: { workspaceId_platform: { workspaceId: wsId, platform } },
        create: { workspaceId: wsId, platform, results: n },
        update: { results: { increment: n } },
      })
      .catch(() => undefined)
  }
}

/** جوب جاف (صفر عناصر) = هدم خفيف — المنصة السكونية تتنادى أقل */
export async function recordSkillDryRun(wsId: string, platform: string): Promise<void> {
  if (!platform) return
  try {
    const row = await db.skillStat.upsert({
      where: { workspaceId_platform: { workspaceId: wsId, platform } },
      create: { workspaceId: wsId, platform, weight: 0.9 },
      update: {},
    })
    await db.skillStat.update({ where: { id: row.id }, data: { weight: clamp(row.weight - 0.08) } })
  } catch {
    // التعلم best-effort
  }
}

/** تسجيل دخول مهارات في جوب اكتشاف (runs++ / lastUsedAt) */
export async function recordSkillRun(wsId: string, platforms: string[]): Promise<void> {
  const now = new Date()
  for (const platform of [...new Set(platforms)]) {
    if (!platform) continue
    await db.skillStat
      .upsert({
        where: { workspaceId_platform: { workspaceId: wsId, platform } },
        create: { workspaceId: wsId, platform, runs: 1, lastUsedAt: now },
        update: { runs: { increment: 1 }, lastUsedAt: now },
      })
      .catch(() => undefined)
  }
}

/** جوب جاب عناصر من غير ليدز = هدم أخف (تعب على البحث من غير حصاد) — وزن بس، النتايج متحسبت في recordSkillResults */
export async function recordSkillNoLeads(wsId: string, platform: string): Promise<void> {
  if (!platform) return
  try {
    const row = await db.skillStat.upsert({
      where: { workspaceId_platform: { workspaceId: wsId, platform } },
      create: { workspaceId: wsId, platform, weight: 0.97 },
      update: {},
    })
    await db.skillStat.update({ where: { id: row.id }, data: { weight: clamp(row.weight - 0.03) } })
  } catch {
    // best-effort
  }
}

/** ليد جديد من مهارة — مكافأة فورية (وزن أعلى = نداء أكتر في الموجة الجاية) */
export async function recordSkillLead(
  wsId: string,
  platform: string,
  opts?: { win?: boolean; qualityScore?: number },
): Promise<void> {
  if (!platform) return
  const win = opts?.win ?? false
  try {
    await db.skillStat.upsert({
      where: { workspaceId_platform: { workspaceId: wsId, platform } },
      create: { workspaceId: wsId, platform, leads: 1, wins: win ? 1 : 0, weight: win ? 1.4 : 1.2, lastLeadAt: new Date() },
      update: {
        leads: { increment: 1 },
        wins: win ? { increment: 1 } : undefined,
        weight: { increment: win ? 0.25 : 0.15 },
        lastLeadAt: new Date(),
      },
    })
  } catch {
    // best-effort
  }
}

/** ذاكرة الاستعلامات: استعلام جاب ليد = درس يتسجل (أو يتراكم عليه) */
export async function recordLesson(
  wsId: string,
  platform: string,
  query: string,
  opts?: { qualityScore?: number; source?: "learned" | "ai"; niche?: string },
): Promise<void> {
  const q = query.trim()
  if (!platform || q.length < 6 || q.length > 200) return
  try {
    await db.skillLesson.upsert({
      where: { workspaceId_platform_query: { workspaceId: wsId, platform, query: q } },
      create: {
        workspaceId: wsId,
        platform,
        query: q,
        niche: opts?.niche,
        leads: 1,
        quality: opts?.qualityScore ?? 0,
        source: opts?.source ?? "learned",
      },
      update: {
        leads: { increment: 1 },
        quality: { increment: opts?.qualityScore ?? 0 },
      },
    })
  } catch {
    // best-effort
  }
}

/** أفضل دروس منصة (الأعلى جودة أولًا) — بترجع قبل الأشكال الثابتة في كل جوب */
export async function topLessons(wsId: string, platform: string, k = 2): Promise<string[]> {
  try {
    const rows = await db.skillLesson.findMany({
      where: { workspaceId: wsId, platform, leads: { gte: 1 } },
      orderBy: [{ quality: "desc" }, { createdAt: "desc" }],
      take: k,
    })
    return rows.map((r) => r.query)
  } catch {
    return []
  }
}

/** آخر استعلامات AI المولّدة لمنصة (مولّدة خلال 24 ساعة) — للتحكم في وتيرة التوليد */
export async function recentAiLessonCount(wsId: string, platform: string, sinceHours = 24): Promise<number> {
  try {
    return await db.skillLesson.count({
      where: {
        workspaceId: wsId,
        platform,
        source: "ai",
        createdAt: { gte: new Date(Date.now() - sinceHours * 3_600_000) },
      },
    })
  } catch {
    return 99 // فشل = لا توليد (آمن)
  }
}

/** حفظ استعلامات AI المولّدة كدروس جاهزة للاستخدام */
export async function saveAiLessons(wsId: string, platform: string, queries: string[], niche: string): Promise<void> {
  for (const q of queries) {
    const query = q.trim()
    if (query.length < 6 || query.length > 200) continue
    await db.skillLesson
      .upsert({
        where: { workspaceId_platform_query: { workspaceId: wsId, platform, query } },
        create: { workspaceId: wsId, platform, query, niche, source: "ai", leads: 0, quality: 0 },
        update: { niche },
      })
      .catch(() => undefined)
  }
}
