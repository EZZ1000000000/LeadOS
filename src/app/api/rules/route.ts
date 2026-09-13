import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { asArray } from "@/lib/constants"
import { buildSearchPlan } from "@/lib/discovery"

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const raw = await db.searchRule.findMany({
    where: { workspaceId: auth.workspace.id },
    include: { actions: { orderBy: { order: "asc" } }, _count: { select: { searches: true } } },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  })
  // Normalize Json array fields so the client always receives string[]
  const rules = raw.map((r) => ({
    ...r,
    countries: asArray(r.countries),
    cities: asArray(r.cities),
    industries: asArray(r.industries),
    services: asArray(r.services),
    keywords: asArray(r.keywords),
    excludedWords: asArray(r.excludedWords),
    sourceTypes: asArray(r.sourceTypes),
  }))
  return json({ rules })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = await readBody<{
    name?: string; description?: string; cities?: string[]; industries?: string[]
    services?: string[]; keywords?: string[]; excludedWords?: string[]
    sourceTypes?: string[]; minLeadScore?: number; researchDepth?: string
    startResearch?: boolean; priority?: number
  }>(req)
  if (!body?.name?.trim()) return jsonError("اسم القاعدة مطلوب")

  const rule = await db.searchRule.create({
    data: {
      workspaceId: auth.workspace.id,
      name: body.name.trim(),
      description: body.description,
      cities: (body.cities ?? []) as unknown as Prisma.InputJsonValue,
      industries: (body.industries ?? []) as unknown as Prisma.InputJsonValue,
      services: (body.services ?? []) as unknown as Prisma.InputJsonValue,
      keywords: (body.keywords ?? []) as unknown as Prisma.InputJsonValue,
      excludedWords: (body.excludedWords ?? []) as unknown as Prisma.InputJsonValue,
      sourceTypes: (body.sourceTypes ?? ["GOOGLE_SEARCH", "WEBSITE"]) as unknown as Prisma.InputJsonValue,
      minLeadScore: body.minLeadScore ?? 0,
      researchDepth: (body.researchDepth ?? "DEEP") as never,
      startResearch: body.startResearch ?? true,
      priority: body.priority ?? 100,
    },
  })
  // Show the generated query plan immediately
  const plan = buildSearchPlan(rule)
  return json({ rule, plan }, 201)
}
