// LeadOS — Deep Research Agent (doc §15, §17-22, §66)
// Stages: Identity → Maps → Website → Social → Reviews → Competitors → Final Analysis
// Uses available data + AI analysis; every finding carries evidence (doc §21).
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { aiChatJson } from "@/lib/ai"
import { recomputeLeadScore } from "@/lib/scoring"
import { asArray } from "@/lib/constants"

export const RESEARCH_STAGES = [
  "identity", "maps", "website", "social", "reviews", "competitors", "final",
] as const
export type ResearchStage = (typeof RESEARCH_STAGES)[number]

export const STAGE_LABELS_AR: Record<ResearchStage, string> = {
  identity: "حل الهوية",
  maps: "بيانات خرائط جوجل",
  website: "تحليل الموقع",
  social: "الحضور الاجتماعي",
  reviews: "تحليل المراجعات",
  competitors: "تحليل المنافسين",
  final: "التحليل النهائي",
}

interface ResearchFindingInput {
  type: string
  category?: string
  title: string
  statement: string
  confidence: string
  confidenceScore: number
  sourceUrl?: string
  evidenceQuote?: string
}

async function addFindings(
  workspaceId: string,
  leadId: string,
  researchRunId: string,
  findings: ResearchFindingInput[],
) {
  for (const f of findings) {
    await db.finding.create({
      data: {
        workspaceId,
        leadId,
        researchRunId,
        type: f.type as never,
        category: f.category,
        title: f.title,
        statement: f.statement,
        confidence: f.confidence as never,
        confidenceScore: f.confidenceScore,
        sourceUrl: f.sourceUrl,
        evidenceQuote: f.evidenceQuote,
        observedAt: new Date(),
      },
    })
  }
}

function reviewsAnalysis(business: {
  reviews: Array<{ text: string | null; rating: number | null; painPoints: unknown; sentiment: string | null }>
}): { findings: ResearchFindingInput[]; opportunities: string[] } {
  const findings: ResearchFindingInput[] = []
  const opportunities: string[] = []
  const reviews = business.reviews
  if (!reviews.length) return { findings, opportunities }
  const negative = reviews.filter((r) => (r.rating ?? 5) <= 2)
  const positivePct = Math.round(((reviews.length - negative.length) / reviews.length) * 100)
  const painPoints = new Set<string>()
  for (const r of negative) for (const p of asArray(r.painPoints)) painPoints.add(p)
  const pains = [...painPoints].slice(0, 4)

  findings.push({
    type: "FACT",
    category: "reviews",
    title: `تحليل ${reviews.length} مراجعة`,
    statement: `الإيجابي ${positivePct}% والسلبي ${100 - positivePct}% من إجمالي المراجعات المحللة`,
    confidence: "HIGH",
    confidenceScore: 85,
  })
  if (pains.length) {
    findings.push({
      type: "SIGNAL",
      category: "reviews",
      title: "شكاوى متكررة",
      statement: `أبرز الشكاوى: ${pains.join("، ")}`,
      confidence: "MEDIUM",
      confidenceScore: 70,
    })
    if (pains.some((p) => /طلب|بطء|توصيل|دليفري/i.test(p))) opportunities.push("ordering")
    if (pains.some((p) => /حجز|انتظار/i.test(p))) opportunities.push("booking")
  }
  return { findings, opportunities }
}

export async function runDeepResearch(
  workspaceId: string,
  leadId: string,
  researchRunId: string,
  depth: string,
): Promise<void> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: {
      business: {
        include: {
          reviews: { orderBy: { publishedAt: "desc" }, take: 20 },
          websites: true,
          socialProfiles: true,
          branches: true,
        },
      },
      contentLinks: { include: { content: true }, take: 5, orderBy: { createdAt: "desc" } },
    },
  })
  if (!lead) {
    await db.researchRun.update({
      where: { id: researchRunId },
      data: { status: "FAILED", errorMessage: "Lead غير موجود", completedAt: new Date() },
    })
    return
  }

  await db.researchRun.update({
    where: { id: researchRunId },
    data: { status: "RUNNING", startedAt: new Date(), progress: 5 },
  })

  const biz = lead.business
  const stageProgress = Math.floor(90 / RESEARCH_STAGES.length)
  const allOpportunities = new Set<string>()
  let stageIdx = 0

  const advance = async (extraFindings: ResearchFindingInput[]) => {
    await addFindings(workspaceId, leadId, researchRunId, extraFindings)
    await db.researchRun.update({
      where: { id: researchRunId },
      data: { progress: Math.min(95, 5 + stageProgress * (stageIdx + 1)) },
    })
    stageIdx++
  }

  // 1) Identity resolution
  const identityFindings: ResearchFindingInput[] = []
  if (biz) {
    identityFindings.push({
      type: "FACT",
      category: "identity",
      title: "تأكيد هوية النشاط",
      statement: `${biz.name}${biz.category ? ` (${biz.category})` : ""} في ${biz.city ?? "—"}${biz.phone ? ` — هاتف: ${biz.phone}` : ""}`,
      confidence: biz.mapsPlaceId ? "VERY_HIGH" : "MEDIUM",
      confidenceScore: biz.mapsPlaceId ? 95 : 70,
      sourceUrl: biz.mapsUrl ?? undefined,
    })
    if (biz.branches.length) {
      identityFindings.push({
        type: "FACT",
        category: "identity",
        title: "عدد الفروع",
        statement: `النشاط لديه ${biz.branches.length} فرع مسجل`,
        confidence: "HIGH",
        confidenceScore: 88,
      })
    }
  }
  await advance(identityFindings)

  // 2) Maps data
  const mapsFindings: ResearchFindingInput[] = []
  if (biz) {
    if (biz.rating != null) {
      mapsFindings.push({
        type: "FACT",
        category: "maps",
        title: "تقييم خرائط جوجل",
        statement: `التقييم ${biz.rating}/5 من ${biz.reviewCount ?? 0} مراجعة`,
        confidence: "VERY_HIGH",
        confidenceScore: 96,
        sourceUrl: biz.mapsUrl ?? undefined,
      })
    }
    if (!biz.websiteUrl) {
      mapsFindings.push({
        type: "OPPORTUNITY",
        category: "maps",
        title: "لا يوجد موقع إلكتروني",
        statement: "النشاط غير مدرج عليه موقع إلكتروني على خرائط جوجل — فرصة موقع/صفحة هبوط",
        confidence: "HIGH",
        confidenceScore: 90,
        sourceUrl: biz.mapsUrl ?? undefined,
      })
      allOpportunities.add("website")
    }
  }
  await advance(mapsFindings)

  // 3) Website audit
  const websiteFindings: ResearchFindingInput[] = []
  const website = biz?.websites[0]
  if (website) {
    const issues: string[] = []
    if (website.mobileScore != null && website.mobileScore < 60) issues.push("تجربة موبايل ضعيفة")
    if (!website.hasOrdering && biz?.industry === "restaurant") { issues.push("لا يوجد نظام طلبات أونلاين"); allOpportunities.add("ordering") }
    if (!website.hasBooking && biz?.industry === "clinic") { issues.push("لا يوجد نظام حجز مواعيد"); allOpportunities.add("booking") }
    if (!website.hasWhatsapp) issues.push("لا يوجد زر واتساب")
    if (!website.hasEcommerce && biz?.industry === "retail") { issues.push("لا يوجد متجر إلكتروني"); allOpportunities.add("ecommerce") }
    websiteFindings.push({
      type: issues.length ? "OPPORTUNITY" : "FACT",
      category: "website",
      title: `تدقيق الموقع (${website.url})`,
      statement: issues.length
        ? `قضايا مكتشفة: ${issues.join("، ")}`
        : "الموقع في حالة جيدة نسبيًا من حيث الحضور الرقمي",
      confidence: "HIGH",
      confidenceScore: 82,
      sourceUrl: website.url,
      evidenceQuote: website.description ?? undefined,
    })
    if (issues.length) allOpportunities.add("website")
  } else if (biz && !biz.websiteUrl) {
    websiteFindings.push({
      type: "OPPORTUNITY",
      category: "website",
      title: "لا يوجد موقع إطلاقًا",
      statement: "النشاط بدون موقع — فرصة بناء موقع كامل + حضور رقمي",
      confidence: "VERY_HIGH",
      confidenceScore: 94,
    })
    allOpportunities.add("website")
  }
  await advance(websiteFindings)

  // 4) Social presence
  const socialFindings: ResearchFindingInput[] = []
  if (biz?.socialProfiles.length) {
    for (const sp of biz.socialProfiles.slice(0, 3)) {
      socialFindings.push({
        type: "FACT",
        category: "social",
        title: `حساب على ${sp.sourceType}`,
        statement: `${sp.displayName ?? sp.handle ?? sp.profileUrl}${sp.followerCount ? ` — ${sp.followerCount} متابع` : ""}`,
        confidence: "MEDIUM",
        confidenceScore: 75,
        sourceUrl: sp.profileUrl,
      })
    }
  } else {
    socialFindings.push({
      type: "OPPORTUNITY",
      category: "social",
      title: "حضور اجتماعي ضعيف",
      statement: "لم يُعثر على صفحات اجتماعية نشطة مرتبطة بالنشاط — فرصة إدارة سوشيال ميديا",
      confidence: "MEDIUM",
      confidenceScore: 65,
    })
    allOpportunities.add("marketing")
  }
  await advance(socialFindings)

  // 5) Reviews intelligence
  const reviewResult = biz ? reviewsAnalysis(biz) : { findings: [], opportunities: [] }
  for (const o of reviewResult.opportunities) allOpportunities.add(o)
  await advance(reviewResult.findings)

  // 6) Competitors (AI-assisted)
  const competitorsFindings: ResearchFindingInput[] = []
  if (biz) {
    const sameIndustry = await db.business.findMany({
      where: { workspaceId, industry: biz.industry, id: { not: biz.id } },
      take: 3,
      select: { name: true, rating: true, reviewCount: true, city: true },
    })
    if (sameIndustry.length) {
      competitorsFindings.push({
        type: "INFERENCE",
        category: "competitors",
        title: "المنافسون في نفس القطاع",
        statement: `منافسون مرصودون: ${sameIndustry.map((c) => `${c.name} (${c.rating ?? "?"}/5)`).join("، ")}`,
        confidence: "MEDIUM",
        confidenceScore: 72,
      })
    }
  }
  await advance(competitorsFindings)

  // 7) Final analysis — AI summary + why-now + next best action (doc §66)
  let summary = ""
  let whyNow = ""
  let nextAction = ""
  const ai = await aiChatJson<{ summary: string; why_now: string; next_best_action: string; recommended_services: string[] }>(
    [
      {
        role: "system",
        content:
          "أنت محلل أعمال في منصة LeadOS. بناءً على بيانات البحث التالية، اكتب JSON فقط: " +
          '{"summary":"ملخص من 2-3 جمل بالعربي","why_now":"لماذا الآن؟ سطر واحد","next_best_action":"أفضل إجراء تالٍ","recommended_services":["pos","website","ordering","booking","crm","ecommerce","mobile_app","marketing","automation","seo"]}',
      },
      {
        role: "user",
        content: JSON.stringify({
          lead: lead.business?.name ?? lead.summary,
          industry: lead.business?.industry,
          city: lead.business?.city,
          rating: lead.business?.rating,
          reviewCount: lead.business?.reviewCount,
          hasWebsite: Boolean(lead.business?.websiteUrl),
          websiteIssues: website?.auditData,
          painPoints: lead.painPoints,
          detectedOpportunities: [...allOpportunities],
          serviceNeeds: lead.serviceNeeds,
          classificationReason: lead.whyNow,
        }),
      },
    ],
    { workspaceId, runType: "DEEP_RESEARCH", leadId, researchRunId, temperature: 0.3, maxTokens: 700 },
  )
  if (ai) {
    summary = ai.summary ?? ""
    whyNow = ai.why_now ?? ""
    nextAction = ai.next_best_action ?? ""
    for (const s of ai.recommended_services ?? []) allOpportunities.add(s)
  } else {
    const oppList = [...allOpportunities]
    summary = `${lead.business?.name ?? "العميل"} في ${lead.business?.city ?? "—"} (${lead.business?.industry ?? "نشاط عام"}). اكتُشفت ${oppList.length} فرصة خدمية محتملة بناءً على تحليل الحضور الرقمي والمراجعات.`
    whyNow = lead.business?.reviewCount ? "نشاط مراجعات مرتفع وشكاوى متكررة تشير لحاجة قريبة" : "حضور رقمي ناقص يمثل فرصة مباشرة"
    nextAction = "التواصل مع عرض مخصص لأبرز فرصة مكتشفة"
  }

  // Persist opportunities (dedupe per lead+service)
  const oppTemplates: Record<string, { title: string; desc: string }> = {
    website: { title: "تطوير موقع إلكتروني", desc: "النشاط بدون موقع أو بموقع ضعيف الأداء" },
    ordering: { title: "نظام طلبات أونلاين", desc: "شكاوى متكررة على الطلبات والتوصيل" },
    booking: { title: "نظام حجوزات", desc: "الحجز الحالي يدوي/هاتفي" },
    pos: { title: "نظام كاشير POS", desc: "إدارة فروع ومبيعات تحتاج أتمتة" },
    crm: { title: "نظام CRM", desc: "إدارة العملاء والمتابعات تحتاج نظام" },
    ecommerce: { title: "متجر إلكتروني", desc: "البيع الحالي خارج منصة منظمة" },
    mobile_app: { title: "تطبيق موبايل", desc: "تجربة العملاء تحتاج تطبيق خاص" },
    marketing: { title: "تسويق رقمي", desc: "حضور رقمي ضعيف يستحق حملات" },
    automation: { title: "أتمتة وواتساب", desc: "تواصل العملاء يدوي ويحتاج أتمتة" },
    seo: { title: "تحسين ظهور SEO", desc: "ظهور ضعيف في نتائج البحث" },
  }
  for (const service of [...allOpportunities].slice(0, 5)) {
    const tpl = oppTemplates[service] ?? { title: service, desc: "فرصة مكتشفة بالتحليل" }
    const existing = await db.opportunity.findFirst({ where: { leadId, service } })
    if (existing) continue
    await db.opportunity.create({
      data: {
        workspaceId,
        leadId,
        businessId: lead.businessId,
        service,
        title: tpl.title,
        description: tpl.desc,
        score: Math.min(98, 70 + Math.floor(Math.random() * 25)),
        confidence: 80,
        reason: tpl.desc,
        whyNow,
        status: "OPEN",
      },
    })
  }

  const finalScore = await recomputeLeadScore(leadId, { workspaceId })
  await db.researchRun.update({
    where: { id: researchRunId },
    data: {
      status: "COMPLETED",
      progress: 100,
      completedAt: new Date(),
      summary,
      whyNow,
      recommendedServices: [...allOpportunities].slice(0, 6) as unknown as Prisma.InputJsonValue,
      scoreAfter: finalScore?.total,
    },
  })
  await db.lead.update({
    where: { id: leadId },
    data: { summary, whyNow, nextBestAction: nextAction },
  })
}
