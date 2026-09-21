// LeadOS — محرك التطور الذاتي (Self-Evolution Engine)
// "النظام ذكي وبيطور بشكل تلقائي" — بيذاكر نتايج تكتيكاته النفسية، يعيد الأوزان، يتعلم أوقاته الذهبية،
// ولو حاب يعمل تطور **جوهري** (استراتيجية/سعة/هوية) بيبعت مقترح في الإشعارات وممنوع ينفذ من غير موافقة المالك.
// المبدأ: يرجع للمالك بس لو محتاجه — التعلم والتعديل الدقيق صامت، الجوهري فقط بإشعار موافقة.
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { recordInsight, topInsights } from "@/lib/agent/memory"

// ══════════ تسجيل الاستخدام والفوز ══════════

export async function recordTacticUse(wsId: string, family: string, tacticId: string): Promise<void> {
  if (!tacticId || !family) return
  try {
    await db.tacticStat.upsert({
      where: { workspaceId_family_tacticId: { workspaceId: wsId, family, tacticId } },
      create: { workspaceId: wsId, family, tacticId, used: 1, lastUsedAt: new Date() },
      update: { used: { increment: 1 }, lastUsedAt: new Date() },
    })
  } catch {
    /* الإحصاء مش سبب لفشل الشغل */
  }
}

export async function creditTacticWin(wsId: string, family: string, tacticId: string): Promise<void> {
  if (!tacticId || !family) return
  try {
    await db.tacticStat.upsert({
      where: { workspaceId_family_tacticId: { workspaceId: wsId, family, tacticId } },
      create: { workspaceId: wsId, family, tacticId, used: 1, wins: 1, weight: 1.5, lastUsedAt: new Date(), lastWinAt: new Date() },
      update: { wins: { increment: 1 }, lastWinAt: new Date() },
    })
  } catch {
    /* تجاهل */
  }
}

// ══════════ الاختيار الموزّع (استغلال 85% / استكشاف 15%) ══════════

/** اختيار تكتيك بالوزن — الفائزين بياخدوا حظ أكبر، لكن الاستكشاف مستمر (السوق بيتغير) */
export async function pickTactic(wsId: string, family: string, candidates: string[]): Promise<string> {
  if (!candidates.length) return ""
  if (candidates.length === 1) return candidates[0]
  try {
    const stats = await db.tacticStat.findMany({ where: { workspaceId: wsId, family, tacticId: { in: candidates } } })
    const weightOf = (id: string) => {
      const s = stats.find((x) => x.tacticId === id)
      if (!s) return 1.0 // تكتيك جديد = وزن محايد (فرصة إثبات)
      return Math.max(0.15, Math.min(4, s.weight))
    }
    const explore = Math.random() < 0.15
    if (explore) return candidates[Math.floor(Math.random() * candidates.length)]
    const total = candidates.reduce((acc, c) => acc + weightOf(c), 0)
    let r = Math.random() * total
    for (const c of candidates) {
      r -= weightOf(c)
      if (r <= 0) return c
    }
    return candidates[candidates.length - 1]
  } catch {
    return candidates[Math.floor(Math.random() * candidates.length)]
  }
}

// ══════════ بوابة التكرار (نبضة التعلم — مرة كل 30 دقيقة بالكتير) ══════════

async function lastRunAt(wsId: string): Promise<Date> {
  const marker = await db.agentInsight.findFirst({ where: { workspaceId: wsId, kind: "evolution", pattern: "_lastRun" } })
  return marker ? new Date(marker.note) : new Date(Date.now() - 3600_000)
}

async function markRun(wsId: string): Promise<void> {
  const existing = await db.agentInsight.findFirst({ where: { workspaceId: wsId, kind: "evolution", pattern: "_lastRun" } })
  const nowIso = new Date().toISOString()
  if (existing) await db.agentInsight.update({ where: { id: existing.id }, data: { note: nowIso, weight: { increment: 1 } } })
  else await db.agentInsight.create({ data: { workspaceId: wsId, kind: "evolution", pattern: "_lastRun", note: nowIso } })
}

// ══════════ الإشعارات — بس لما المالك محتاج ══════════

async function notify(wsId: string, type: string, title: string, message: string, severity: "INFO" | "WARNING" | "CRITICAL" = "INFO", actionUrl?: string, metadata?: Prisma.InputJsonValue): Promise<void> {
  await db.alert.create({
    data: { workspaceId: wsId, type, title, message, severity, actionUrl: actionUrl ?? "/?view=zizo", metadata },
  }).catch(() => undefined)
}

// ══════════ المقترحات الجوهرية ══════════

export interface ProposalInput {
  title: string
  kind: "STRATEGY" | "CAPACITY" | "IDENTITY" | "FEATURE" | "TEMPLATE_FAMILY"
  rationale: string
  impact?: string
  plan: { action: "config" | "angle_default" | "noop"; patch?: Record<string, unknown>; angle?: string }
}

/** اقتراح تطور جوهري → مقترح + إشعار موافقة. ممنوع أي تنفيذ هنا. */
export async function proposeFundamental(wsId: string, p: ProposalInput): Promise<boolean> {
  // ديدوب: مفيش مقترح PENDING من نفس النوع + كولداون 3 أيام بين المقترحات عموماً
  const pendingSame = await db.evolutionProposal.findFirst({ where: { workspaceId: wsId, status: "PENDING", kind: p.kind } })
  if (pendingSame) return false
  const lastProp = await db.agentInsight.findFirst({ where: { workspaceId: wsId, kind: "evolution", pattern: "_lastProposal" } })
  if (lastProp && Date.now() - new Date(lastProp.note).getTime() < 3 * 24 * 3600_000) return false
  await db.evolutionProposal.create({
    data: {
      workspaceId: wsId,
      title: p.title.slice(0, 200),
      kind: p.kind,
      rationale: p.rationale.slice(0, 600),
      impact: p.impact?.slice(0, 300),
      plan: p.plan as unknown as Prisma.InputJsonValue,
    },
  })
  // كولداون المقترحات — آخر مقترح اتبعت إمتى
  const marker = await db.agentInsight.findFirst({ where: { workspaceId: wsId, kind: "evolution", pattern: "_lastProposal" } })
  if (marker) await db.agentInsight.update({ where: { id: marker.id }, data: { note: new Date().toISOString() } })
  else await db.agentInsight.create({ data: { workspaceId: wsId, kind: "evolution", pattern: "_lastProposal", note: new Date().toISOString() } })
  await notify(
    wsId,
    "EVOLUTION_PROPOSAL",
    `🧠 زيزو عايز موافقتك: ${p.title}`,
    `${p.rationale}\n\nالأثر المتوقع: ${p.impact ?? "تحسين التحويل"}\n\nوافق أو ارفض من صفحة زيزو — مفيش تنفيذ قبل إشارتك.`,
    "WARNING",
    "/?view=zizo",
  )
  return true
}

/** قرار المالك: موافقة → تطبيق الخطة فوراً. رفض → أرشفة مع الملاحظة. */
export async function decideProposal(wsId: string, proposalId: string, approve: boolean, note?: string): Promise<{ ok: boolean; note: string }> {
  const prop = await db.evolutionProposal.findFirst({ where: { id: proposalId, workspaceId: wsId } })
  if (!prop) return { ok: false, note: "المقترح غير موجود" }
  if (prop.status !== "PENDING") return { ok: false, note: "المقترح اتقرر عليه قبل كده" }

  if (!approve) {
    await db.evolutionProposal.update({
      where: { id: prop.id },
      data: { status: "REJECTED", decisionNote: note?.slice(0, 300) ?? "مرفوض من المالك", decidedAt: new Date() },
    })
    await recordInsight(wsId, "evolution", `rejected:${prop.kind}`, `المالك رفض: ${prop.title}`, { proposalId: prop.id })
    await notify(wsId, "EVOLUTION_DECISION", `اترفض: ${prop.title}`, "المقترح اتأرشف — زيزو هيكمل بالوضع الحالي ومش هيقترح ده تاني قريب.", "INFO")
    return { ok: true, note: "اترفض — النظام هيكمل زي ما هو" }
  }

  // التطبيق حسب الخطة
  const plan = prop.plan as ProposalInput["plan"]
  let applied = "تمام"
  try {
    if (plan.action === "config" && plan.patch) {
      const ws = await db.workspace.findUnique({ where: { id: wsId }, select: { settings: true } })
      const cur = (ws?.settings ?? {}) as Record<string, unknown>
      const next = { ...cur, zizo: { ...((cur.zizo ?? {}) as Record<string, unknown>), ...plan.patch } }
      await db.workspace.update({ where: { id: wsId }, data: { settings: next as never } })
      applied = `إعدادات زيزو اتحدثت (${Object.keys(plan.patch).join("، ")})`
    } else if (plan.action === "angle_default" && plan.angle) {
      const ws = await db.workspace.findUnique({ where: { id: wsId }, select: { settings: true } })
      const cur = (ws?.settings ?? {}) as Record<string, unknown>
      const next = { ...cur, zizo: { ...((cur.zizo ?? {}) as Record<string, unknown>), defaultCommentAngle: plan.angle } }
      await db.workspace.update({ where: { id: wsId }, data: { settings: next as never } })
      applied = `الركن النفسي الافتراضي بقى: ${plan.angle}`
    }
    await db.evolutionProposal.update({
      where: { id: prop.id },
      data: { status: "APPLIED", decisionNote: note?.slice(0, 300), decidedAt: new Date(), appliedAt: new Date() },
    })
    await recordInsight(wsId, "evolution", `applied:${prop.kind}`, `المالك وافق واتطبق: ${prop.title}`, { proposalId: prop.id, applied })
    await notify(wsId, "EVOLUTION_DECISION", `✅ اتطبق: ${prop.title}`, `${applied} — زيزو شغال بيه من دلوقتي.`, "INFO")
    return { ok: true, note: `اتوافق واتطبق: ${applied}` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "فشل التطبيق"
    await db.evolutionProposal.update({ where: { id: prop.id }, data: { decisionNote: msg.slice(0, 300) } })
    return { ok: false, note: `الموافقة تمت لكن التطبيق فشل: ${msg}` }
  }
}

// ══════════ نبضة التعلم — بتشتغل مع كل tick (خفيفة ومحدودة) ══════════

export interface EvolutionTickResult {
  learned: string[]
  weightsUpdated: number
  proposal?: string
  notes: string[]
}

export async function evolutionTick(wsId: string): Promise<EvolutionTickResult> {
  const out: EvolutionTickResult = { learned: [], weightsUpdated: 0, notes: [] }
  const last = await lastRunAt(wsId)
  const since = Date.now() - last.getTime()
  if (since < 25 * 60_000) return out // لسه بدري — التعلم مش محتاج استعجال
  await markRun(wsId)

  // 1) فضل الفوز للردود: تحولات مرحلية مسجلة من آخر نبضة → آخر رسالة فيها tactic تتكريم
  const stageInsights = await db.agentInsight.findMany({
    where: { workspaceId: wsId, kind: "sales", createdAt: { gte: last }, pattern: { contains: "→" } },
    take: 60,
  })
  for (const ins of stageInsights) {
    const convId = (ins.evidence as { conversationId?: string } | null)?.conversationId
    if (!convId) continue
    const msg = await db.message.findFirst({
      where: { conversationId: convId, direction: "OUT", author: "ZIZO" },
      orderBy: { sentAt: "desc" },
    })
    const tactic = (msg?.meta as { tactic?: string } | null)?.tactic
    if (tactic) {
      await creditTacticWin(wsId, "reply", tactic)
      out.learned.push(`رد فاز: ${tactic} (${ins.pattern})`)
    }
  }

  // 2) فضل الفوز للتعليقات: تعليق ناجح → لو العميل رد فعلاً (رسالة CLIENT على محادثة الليد بعد التعليق)
  const commentJobs = await db.job.findMany({
    where: { workspaceId: wsId, type: "FB_COMMENT", status: "SUCCESS", completedAt: { gte: last } },
    take: 40,
  })
  for (const job of commentJobs) {
    const angle = (job.result as { angle?: string } | null)?.angle
    const leadId = (job.payload as { leadId?: string } | null)?.leadId
    if (!angle || !leadId) continue
    const conv = await db.conversation.findFirst({ where: { workspaceId: wsId, leadId }, select: { id: true } })
    if (!conv) continue
    const clientReply = await db.message.count({
      where: { conversationId: conv.id, direction: "IN", author: "CLIENT", sentAt: { gte: job.completedAt ?? job.createdAt } },
    })
    if (clientReply > 0) {
      await creditTacticWin(wsId, "comment", angle)
      out.learned.push(`تعليق فاز: ${angle} — العميل رد`)
    }
  }

  // 3) إعادة حساب الأوزان (تنعيم لابلاس + إفادة الجدة + تحلل القِدَم)
  const stats = await db.tacticStat.findMany({ where: { workspaceId: wsId } })
  const now = Date.now()
  for (const s of stats) {
    const winRate = (s.wins + 0.5) / (s.used + 2)
    let w = 0.5 + 2.2 * winRate
    if (s.lastWinAt && now - s.lastWinAt.getTime() < 7 * 24 * 3600_000) w *= 1.1
    if (s.lastUsedAt && now - s.lastUsedAt.getTime() > 21 * 24 * 3600_000) w *= 0.8
    w = Math.max(0.2, Math.min(3.5, w))
    if (Math.abs(w - s.weight) > 0.05) {
      await db.tacticStat.update({ where: { id: s.id }, data: { weight: Math.round(w * 100) / 100 } })
      out.weightsUpdated++
    }
  }

  // 4) دروس متراكمة: أبطال + خاسرين (كذاكرة بيوصلوا لبرومبتات زيزو عبر topInsights)
  for (const s of stats) {
    if (s.used < 6) continue
    const winRate = s.wins / s.used
    if (winRate >= 0.45) {
      await recordInsight(wsId, "evolution", `champion:${s.family}:${s.tacticId}`, `التكتيك «${s.tacticId}» بيكسّر: ${s.wins}/${s.used} فوز — استخدمه أكتر`, { tacticId: s.tacticId, family: s.family, winRate })
      out.learned.push(`بطل: ${s.tacticId} (${s.wins}/${s.used})`)
    } else if (winRate <= 0.12 && s.used >= 8) {
      await recordInsight(wsId, "evolution", `loser:${s.family}:${s.tacticId}`, `التكتيك «${s.tacticId}» ضعيف: ${s.wins}/${s.used} بس — قلل استخدامه`, { tacticId: s.tacticId, family: s.family, winRate })
      out.learned.push(`ضعيف: ${s.tacticId} (${s.wins}/${s.used})`)
    }
  }

  // 5) الساعات الذهبية: أوقات نجاح التعليقات → تفضيل جدولة
  const winsByHour = new Map<number, number>()
  for (const job of commentJobs) {
    if (!(job.completedAt instanceof Date)) continue
    const cairo = new Date(job.completedAt.toLocaleString("en-US", { timeZone: "Africa/Cairo" }))
    const h = cairo.getHours()
    winsByHour.set(h, (winsByHour.get(h) ?? 0) + 1)
  }
  const bestHour = [...winsByHour.entries()].sort((a, b) => b[1] - a[1])[0]
  if (bestHour && bestHour[1] >= 3) {
    await recordInsight(wsId, "evolution", `hour:${bestHour[0]}`, `ساعة ${bestHour[0]} بالقاهرة هي أنجح ساعة للتعليقات (${bestHour[1]} نجاح) — فضّل جدولة التعليقات حواليها`, { hour: bestHour[0], wins: bestHour[1] })
    out.learned.push(`ساعة ذهبية: ${bestHour[0]}:00`)
  }

  // 6) الفرص الجوهرية — مقترحات بإشعار (ممنوع تنفيذ صامت)
  const proposal = await detectFundamentalOpportunity(wsId, stats)
  if (proposal) out.proposal = proposal

  // 7) فقط لو حاجة عطلت فعلاً → صوت (الرادار بيقول الجلسة وقعت)
  const groups = await db.monitoredGroup.findMany({ where: { workspaceId: wsId, platform: "FACEBOOK" }, select: { status: true } })
  const fb = groups.length
  const dead = groups.filter((g) => g.status === "NEEDS_SESSION" || g.status === "BLOCKED").length
  if (fb >= 3 && dead / fb >= 0.5) {
    const recentAlert = await db.alert.findFirst({
      where: { workspaceId: wsId, type: "RADAR_SESSION_DEAD", createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
    })
    if (!recentAlert) {
      await notify(wsId, "RADAR_SESSION_DEAD", "⚠️ جلسة فيسبوك ضعيفة — الرادار واقف", `${dead} من ${fb} جروبات مش قادرين يتفتحوا (الجلسة وقعت أو حظر مؤقت). حدّث الكوكيز من صفحة الجروبات عشان زيزو يكمل.`, "CRITICAL")
      out.notes.push("تنبيه جلسة ضعيفة اتبعت")
    }
  }
  return out
}

/** كشف فرص التطور الجوهري — بيقترح بس، التنفيذ بموافقة المالك */
async function detectFundamentalOpportunity(wsId: string, stats: Array<{ family: string; tacticId: string; used: number; wins: number }>): Promise<string | undefined> {
  // فرصة 1: ركن تعليق مسيطر → اقتراح اعتماده افتراضياً
  const champ = stats
    .filter((s) => s.family === "comment" && s.used >= 10 && s.wins / s.used >= 0.5)
    .sort((a, b) => b.wins / b.used - a.wins / a.used)[0]
  if (champ) {
    const created = await proposeFundamental(wsId, {
      title: "اعتماد الركن النفسي الفائز كافتراضي في تعليقات الرادار",
      kind: "STRATEGY",
      rationale: `التعليقات بأسلوب «${champ.tacticId}» نجاحها ${Math.round((champ.wins / champ.used) * 100)}% (${champ.wins} من ${champ.used}) — أعلى من باقي الأساليب بوضوح. أقترح اعتماده ركن افتراضي في 70% من التعليقات الجاية مع تنويع للباقي.`,
      impact: "رفع معدل رد العملاء على التعليقات — نفس العدد تعليقات بنتايج أعلى",
      plan: { action: "angle_default", angle: champ.tacticId },
    })
    if (created) return champ.tacticId
  }

  // فرصة 2: المالك بيوافق على الدRAFTات بشكل شبه كامل → اقتراح أتمتة الرد على العملاء اللي كلمنا الأول
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000)
  const drafts = await db.message.findMany({
    where: { direction: "OUT", author: "ZIZO", sentAt: { gte: weekAgo }, meta: { not: undefined } },
    select: { meta: true },
    take: 200,
  })
  const pendingish = drafts.filter((m) => (m.meta as { draft?: boolean } | null)?.draft === true)
  const approvedish = drafts.filter((m) => (m.meta as { approved?: boolean } | null)?.approved === true)
  if (pendingish.length + approvedish.length >= 10 && approvedish.length / (approvedish.length + pendingish.length) >= 0.8) {
    const created = await proposeFundamental(wsId, {
      title: "تفعيل الرد التلقائي على العملاء الواردين (بدون انتظار موافقة لكل رسالة)",
      kind: "FEATURE",
      rationale: `في آخر 7 أيام وافقت على ${approvedish.length} من ${approvedish.length + pendingish.length} رسالة (${Math.round((approvedish.length / (approvedish.length + pendingish.length)) * 100)}%) — يعني نمط موافقتك شبه ثابت. أقترح: الرد على العملاء اللي كتبوا الأول يتبعت تلقائياً (لأنه رد مش مبادرة)، والمبادرات الباردة تفضل مستنية موافقتك.`,
      impact: "سرعة رد أعلى = تحويل أعلى (العميل الأول ربع ساعة هو أحسن فرصة) — وترتاح من مراجعة كل رسالة",
      plan: { action: "config", patch: { requireApproval: false } },
    })
    if (created) return "auto_inbound_replies"
  }
  return undefined
}

// ══════════ إحصائيات للواجهة ══════════

export async function evolutionStats(wsId: string) {
  const [stats, proposals, learnings] = await Promise.all([
    db.tacticStat.findMany({ where: { workspaceId: wsId }, orderBy: [{ weight: "desc" }], take: 14 }),
    db.evolutionProposal.findMany({ where: { workspaceId: wsId }, orderBy: { createdAt: "desc" }, take: 8 }),
    topInsights(wsId, 8),
  ])
  return {
    tactics: stats.map((s) => ({
      family: s.family,
      tacticId: s.tacticId,
      used: s.used,
      wins: s.wins,
      winRate: s.used ? Math.round((s.wins / s.used) * 100) : 0,
      weight: Math.round(s.weight * 100) / 100,
    })),
    proposals: proposals.map((p) => ({
      id: p.id,
      title: p.title,
      kind: p.kind,
      rationale: p.rationale,
      impact: p.impact,
      status: p.status,
      decisionNote: p.decisionNote,
      createdAt: p.createdAt,
    })),
    learnings: learnings.filter((l) => l.kind === "evolution" && !l.pattern.startsWith("_")).map((l) => ({ pattern: l.pattern, note: l.note, weight: l.weight })),
  }
}
