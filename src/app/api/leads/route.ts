import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { asArray } from "@/lib/constants"
import { recomputeLeadScore } from "@/lib/scoring"

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const wsId = auth.workspace.id
  const url = new URL(req.url)
  const q = url.searchParams.get("q")?.trim()
  const status = url.searchParams.get("status")
  const temperature = url.searchParams.get("temperature")
  const source = url.searchParams.get("source")
  const industry = url.searchParams.get("industry")
  const city = url.searchParams.get("city")
  const minScore = url.searchParams.get("minScore")
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 60))

  const where: Prisma.LeadWhereInput = { workspaceId: wsId }
  if (status && status !== "ALL") where.status = status as never
  if (temperature && temperature !== "ALL") where.temperature = temperature as never
  if (source && source !== "ALL") where.leadSourceType = source as never
  if (minScore && Number(minScore) > 0) where.score = { gte: Number(minScore) }
  let businessFilter: Prisma.BusinessWhereInput | undefined
  if (industry && industry !== "ALL") businessFilter = { ...businessFilter, industry: { contains: industry } }
  if (city && city !== "ALL") businessFilter = { ...businessFilter, city: { contains: city } }
  if (businessFilter) where.business = businessFilter
  if (q) {
    where.OR = [
      { business: { name: { contains: q } } },
      { business: { city: { contains: q } } },
      { summary: { contains: q } },
    ]
  }

  const rawLeads = await db.lead.findMany({
    where,
    include: {
      business: { select: { name: true, city: true, industry: true, category: true, rating: true, reviewCount: true, phone: true, websiteUrl: true } },
      assignedTo: { select: { name: true } },
      _count: { select: { opportunities: true, notes: true, tasks: true, researchRuns: true } },
    },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: limit,
  })
  const leads = rawLeads.map((l) => ({ ...l, serviceNeeds: asArray(l.serviceNeeds) }))

  const facets = {
    industries: [...new Set(leads.map((l) => l.business?.industry).filter(Boolean))],
    cities: [...new Set(leads.map((l) => l.business?.city).filter(Boolean))],
  }
  return json({ leads, facets })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const wsId = auth.workspace.id
  const body = await readBody<{
    companyName?: string; industry?: string; city?: string; phone?: string
    websiteUrl?: string; serviceNeeds?: string[]; summary?: string
  }>(req)
  if (!body?.companyName) return jsonError("اسم الشركة مطلوب")

  const business = await db.business.create({
    data: {
      workspaceId: wsId,
      name: body.companyName,
      industry: body.industry || null,
      city: body.city || null,
      phone: body.phone || null,
      websiteUrl: body.websiteUrl || null,
    },
  })
  const lead = await db.lead.create({
    data: {
      workspaceId: wsId,
      businessId: business.id,
      leadSourceType: "MANUAL",
      createdById: auth.user.id,
      serviceNeeds: body.serviceNeeds ?? [],
      summary: body.summary ?? null,
    },
  })
  await db.leadSource.create({
    data: { leadId: lead.id, sourceType: "MANUAL", label: "إدخال يدوي" },
  })
  await recomputeLeadScore(lead.id, { workspaceId: wsId })
  const fresh = await db.lead.findUnique({ where: { id: lead.id }, include: { business: true } })
  return json({ lead: fresh }, 201)
}
