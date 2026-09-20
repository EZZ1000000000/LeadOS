// LeadOS — محرك سلاسل المتابعة متعددة اللمسات (الموجة الجديدة)
// المبدأ: 80% من الصفقات بتقفل بعد 3-5 لمسات — السلسلة بتحوّل اللمسات من "رسالة ونسكت"
// لجدولة منظمة. سياسة الرد-فقط: كل خطوة بتطلع مهمة بنص جاهز (إرسال بضغطة) —
// مفيش إرسال آلي استباقي خالص. لو الليد رد، السلسلة تتوقف فورًا.
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"

// ---- قوالب افتراضية بالعامية (placeholders بتتستبدل من بيانات الليد، والباقي بيتنضف بالهيومانيز) ----
export interface StepTemplate {
  channel: string
  waitHours: number
  template: string
}

export const DEFAULT_SEQUENCE_TEMPLATES: Array<{
  key: string
  name: string
  description: string
  kind: string
  steps: StepTemplate[]
}> = [
  {
    key: "nurture",
    name: "متابعة الليدز الجديدة (4 لمسات)",
    description: "أول لمسة لطيفة، ثم تذكير، ثم عرض، ثم وداع مهذب — بدون إزعاج",
    kind: "NURTURE",
    steps: [
      {
        channel: "TASK",
        waitHours: 0,
        template:
          "مساء الخير {{contactName}} 👋 اتفرجت على شغل {{business}} وعجبني بصراحة. احنا بنشتغل مع {{industry}} و عندنا شغل ممكن يعجبكم. تحب ابعتلك عينات سريعة؟",
      },
      {
        channel: "TASK",
        waitHours: 72,
        template:
          "أهلاً تاني {{contactName}}، مش هاخد وقتك. القول بسيط: لو حابب تشوف أمثلة لشغلنا مع {{industry}} ابعتلي رقم واتساب وأبعتلك عليه على طول.",
      },
      {
        channel: "TASK",
        waitHours: 120,
        template:
          "{{contactName}} القول ده ساري لفترة محدودة بس: عرض فتح حساب جديد لـ {{business}}. لو مهتم ابعت كلمة «تفاصيل» وأنا هرجعلك فورًا.",
      },
      {
        channel: "TASK",
        waitHours: 240,
        template:
          "آخر رسالة مني أوعّدك، مش هزنقك تاني 😅 لو حصلت حاجة في المستقبل إحنا موجودين. ربنا يوفقك يا {{contactName}}.",
      },
    ],
  },
  {
    key: "reactivation",
    name: "إعادة تفعيل الليدز الباردة (3 لمسات)",
    description: "ليدز وقفت في النص — لمسة إعادة فتح باب الحوار، ثم سؤال مباشر، ثم وداع نهائي",
    kind: "REACTIVATION",
    steps: [
      {
        channel: "TASK",
        waitHours: 0,
        template:
          "أهلاً {{contactName}}، مش قلتلكاش من فترة. عامل إيه في {{business}}؟ عندنا جديد ممكن يهمك — تحب أقولك إيه الموضوع؟",
      },
      {
        channel: "TASK",
        waitHours: 96,
        template:
          "{{contactName}} عارف إن التوقيت بيفرق، فمحتاج كلمة واحدة بس: لسه الموضوع مهتمك ولا لأ؟",
      },
      {
        channel: "TASK",
        waitHours: 240,
        template:
          "هسيبك براحتك يا {{contactName}} 🙏 لو احتجت أي حاجة في أي وقت إحنا موجودين. سلام.",
      },
    ],
  },
  {
    key: "onboard",
    name: "ترحيب بالعملاء الجدد (لمستين)",
    description: "بعد ما العميل يقبض — توثيق العلاقة وفتح باب الريفيرال",
    kind: "ONBOARD",
    steps: [
      {
        channel: "TASK",
        waitHours: 48,
        template:
          "أهلاً تاني {{contactName}} 🎉 مبروك على بداية الشغل مع {{business}}. أي استفسار في أول أسبوع قولي على طول، أنا متابع معاك.",
      },
      {
        channel: "TASK",
        waitHours: 336,
        template:
          "{{contactName}} بعد أسبوعين من الشغل — إيه رأيك في النتايج لحد دلوقتي؟ ولو عجبك الشغل، تعرف حد تاني محتاج نفس الخدمة؟ ريفيرال منك يستاهل خصم 😉",
      },
    ],
  },
]

/** استبدال الـ placeholders من بيانات الليد — أي placeholder فاضي يتشال تمامًا (مفيش أقواس في الرسالة النهائية) */
export function renderTemplate(template: string, lead: { business?: { name?: string | null; industry?: string | null; city?: string | null } | null; person?: { fullName?: string | null } | null; summary?: string | null } | null): string {
  if (!lead) return template.replace(/\{\{[^{}]*\}\}/g, "").replace(/\s{2,}/g, " ").trim()
  const industryArMap: Record<string, string> = {}
  const biz = lead.business
  const out = template
    .replace(/\{\{\s*contactName\s*\}\}/g, lead.person?.fullName ?? "")
    .replace(/\{\{\s*business\s*\}\}/g, biz?.name ?? "")
    .replace(/\{\{\s*industry\s*\}\}/g, biz?.industry ?? "")
    .replace(/\{\{\s*city\s*\}\}/g, biz?.city ?? "")
    .replace(/\{\{\s*service\s*\}\}/g, (lead.summary ?? "").slice(0, 40))
    .replace(/\{\{[^{}]*\}\}/g, "")
  return out.replace(/[\s،,.]+\s*([،,.])/g, "$1").replace(/\s{2,}/g, " ").replace(/^[،,. ]+/, "").trim()
}

/** إنشاء السلاسل الافتراضية أول مرة — بيتندهى من GET /api/sequences */
export async function ensureDefaultSequences(wsId: string): Promise<number> {
  const existing = await db.sequence.findMany({ where: { workspaceId: wsId }, select: { name: true } })
  const names = new Set(existing.map((s) => s.name))
  let created = 0
  for (const tpl of DEFAULT_SEQUENCE_TEMPLATES) {
    if (names.has(tpl.name)) continue
    await db.sequence.create({
      data: {
        workspaceId: wsId,
        name: tpl.name,
        description: tpl.description,
        kind: tpl.kind,
        steps: {
          create: tpl.steps.map((s, i) => ({ order: i + 1, channel: s.channel, template: s.template, waitHours: s.waitHours })),
        },
      },
    })
    created++
  }
  return created
}

/** تجنيد ليد في سلسلة (أو أقرب سلسلة مناسبة لحالته لو مفيش sequenceId) */
export async function enrollLead(wsId: string, leadId: string, sequenceId?: string): Promise<{ ok: boolean; note: string }> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: { id: true, workspaceId: true, status: true, business: { select: { name: true } } },
  })
  if (!lead || lead.workspaceId !== wsId) return { ok: false, note: "الليد غير موجود" }

  let seq = sequenceId
    ? await db.sequence.findFirst({ where: { id: sequenceId, workspaceId: wsId, enabled: true }, include: { steps: { orderBy: { order: "asc" } } } })
    : null
  if (!seq) {
    // اختيار تلقائي: REACTIVATION للبارد، NURTURE للجديد، ONBOARD للويون
    const kind = lead.status === "WON" ? "ONBOARD" : ["CONTACTED", "REPLIED", "NURTURE"].includes(lead.status) ? "REACTIVATION" : "NURTURE"
    seq = await db.sequence.findFirst({
      where: { workspaceId: wsId, enabled: true, kind },
      include: { steps: { orderBy: { order: "asc" } } },
    })
    if (!seq) return { ok: false, note: `مفيش سلسلة مفعّلة من نوع ${kind} — فعّل السلاسل الافتراضية الأول` }
  }
  if (!seq.steps.length) return { ok: false, note: "السلسلة من غير خطوات" }

  const dup = await db.sequenceEnrollment.findUnique({ where: { sequenceId_leadId: { sequenceId: seq.id, leadId } } })
  if (dup && dup.status === "ACTIVE") return { ok: false, note: "الليد مجند بالفعل في السلسلة دي" }
  if (dup) {
    await db.sequenceEnrollment.update({ where: { id: dup.id }, data: { status: "ACTIVE", currentStep: 0, nextStepAt: new Date() } })
    return { ok: true, note: `تم إعادة تجنيد الليد في «${seq.name}»` }
  }
  const firstWait = seq.steps[0]?.waitHours ?? 0
  await db.sequenceEnrollment.create({
    data: {
      workspaceId: wsId,
      sequenceId: seq.id,
      leadId,
      nextStepAt: new Date(Date.now() + firstWait * 3600_000),
    },
  })
  return { ok: true, note: `تم تجنيد الليد في «${seq.name}» (${seq.steps.length} خطوات)` }
}

interface DueEnrollment {
  id: string
  workspaceId: string
  currentStep: number
  leadId: string
  sequence: { id: string; name: string }
  lead: {
    status: string
    lastReplyBy?: null
    business: { name: string; industry: string | null; city: string | null } | null
    person: { fullName: string | null } | null
    summary: string | null
  } | null
}

/**
 * معالجة التجنيدات المستحقة: كل خطوة بقت مهمة TODO بنص جاهز + أنشطة موثقة.
 * لو الليد رد/كسب — السلسلة تكتمل تلقائيًا (مفيش متابعة على عميل رد).
 */
export async function processDueEnrollments(wsId: string, cap = 10): Promise<{ processed: number; completed: number; tasks: number }> {
  const due = (await db.sequenceEnrollment.findMany({
    where: { workspaceId: wsId, status: "ACTIVE", nextStepAt: { lte: new Date() } },
    include: {
      sequence: { select: { id: true, name: true } },
      lead: { select: { status: true, business: { select: { name: true, industry: true, city: true } }, person: { select: { fullName: true } }, summary: true } },
    },
    orderBy: { nextStepAt: "asc" },
    take: cap,
  })) as unknown as DueEnrollment[]

  let processed = 0
  let completed = 0
  let tasksCreated = 0
  for (const en of due) {
    // الليد رد أو اتقفل؟ — السلسلة خلصت
    if (en.lead && (en.lead.status === "WON" || ["REPLIED", "INTERESTED", "MEETING", "PROPOSAL"].includes(en.lead.status))) {
      await db.sequenceEnrollment.update({ where: { id: en.id }, data: { status: "COMPLETED", lastStepAt: new Date() } })
      completed++
      continue
    }
    const steps = await db.sequenceStep.findMany({ where: { sequenceId: en.sequence.id, active: true }, orderBy: { order: "asc" } })
    const step = steps[en.currentStep]
    if (!step) {
      await db.sequenceEnrollment.update({ where: { id: en.id }, data: { status: "COMPLETED", lastStepAt: new Date() } })
      completed++
      continue
    }
    const text = renderTemplate(step.template, en.lead)
    await db.task.create({
      data: {
        workspaceId: wsId,
        leadId: en.leadId,
        title: `لمسة متابعة ${en.currentStep + 1}/${steps.length} — «${en.sequence.name}»`,
        description: `ابعت الرسالة دي للعميل (${step.channel}):\n\n${text}`,
        priority: 70,
      },
    })
    tasksCreated++
    await db.activity.create({
      data: {
        workspaceId: wsId,
        leadId: en.leadId,
        type: "SYSTEM",
        subject: `سلسلة «${en.sequence.name}» — خطوة ${en.currentStep + 1} بقت مهمة جاهزة`,
        body: text.slice(0, 300),
      },
    }).catch(() => undefined)
    const nextStep = steps[en.currentStep + 1]
    await db.sequenceEnrollment.update({
      where: { id: en.id },
      data: {
        currentStep: en.currentStep + 1,
        lastStepAt: new Date(),
        nextStepAt: nextStep ? new Date(Date.now() + nextStep.waitHours * 3600_000) : null,
        status: nextStep ? "ACTIVE" : "COMPLETED",
      },
    })
    processed++
  }
  return { processed, completed, tasks: tasksCreated }
}

/**
 * مسح إعادة التفعيل: ليدز اتكلمت عليها من +14 يوم ووقفوا في النص → تجنيد في سلسلة REACTIVATION.
 * بيتنفذ مرة كل 20 ساعة عبر الـ Job queue (dedup) وبحد أقصى 20 ليد في المرة.
 */
export async function reactivationSweep(wsId: string, cap = 20): Promise<{ enrolled: number; skipped: number }> {
  const seq = await db.sequence.findFirst({
    where: { workspaceId: wsId, enabled: true, kind: "REACTIVATION" },
    include: { steps: { orderBy: { order: "asc" } }, enrollments: { select: { leadId: true, status: true } } },
  })
  if (!seq || !seq.steps.length) return { enrolled: 0, skipped: 0 }

  const enrolledLeadIds = new Set(seq.enrollments.map((e) => e.leadId))
  const stale = await db.lead.findMany({
    where: {
      workspaceId: wsId,
      status: { in: ["QUALIFIED", "CONTACTED", "REPLIED", "NURTURE"] },
      updatedAt: { lt: new Date(Date.now() - 14 * 24 * 3600_000) },
      nextFollowUpAt: null,
    },
    select: { id: true },
    orderBy: { score: "desc" },
    take: cap * 3,
  })

  let enrolled = 0
  let skipped = 0
  for (const l of stale) {
    if (enrolled >= cap) break
    if (enrolledLeadIds.has(l.id)) { skipped++; continue }
    const dupEn = await db.sequenceEnrollment.findFirst({ where: { leadId: l.id, status: "ACTIVE" }, select: { id: true } })
    if (dupEn) { skipped++; continue }
    const firstWait = seq.steps[0]?.waitHours ?? 0
    await db.sequenceEnrollment.create({
      data: {
        workspaceId: wsId,
        sequenceId: seq.id,
        leadId: l.id,
        nextStepAt: new Date(Date.now() + firstWait * 3600_000),
      },
    }).catch(() => undefined)
    enrolled++
  }
  return { enrolled, skipped }
}

/** اختيار نص تجربة A/B (دوري بالحِمل) وتسجيل الإرسال — بتتندهى قبل إرسال أي رسالة تواصل خارجية */
export async function pickAbVariant(wsId: string): Promise<{ experimentId: string; variantIdx: number; template: string } | null> {
  const exp = await db.abExperiment.findFirst({ where: { workspaceId: wsId, status: "RUNNING" }, orderBy: { createdAt: "desc" } })
  if (!exp) return null
  const variants = (exp.variants as Array<{ name: string; template: string; sent: number; replied: number; won: number }>) ?? []
  if (variants.length < 2) return null
  let best = 0
  for (let i = 1; i < variants.length; i++) if ((variants[i].sent ?? 0) < (variants[best].sent ?? 0)) best = i
  variants[best].sent = (variants[best].sent ?? 0) + 1
  await db.abExperiment.update({ where: { id: exp.id }, data: { variants: variants as unknown as Prisma.InputJsonValue } })
  return { experimentId: exp.id, variantIdx: best, template: variants[best].template }
}
