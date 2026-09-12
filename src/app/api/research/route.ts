import { db } from "@/lib/db"
import { json, requireAuth, isResponse } from "@/lib/api-helpers"

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const url = new URL(req.url)
  const leadId = url.searchParams.get("leadId")
  const status = url.searchParams.get("status")

  const runs = await db.researchRun.findMany({
    where: {
      workspaceId: auth.workspace.id,
      ...(leadId ? { leadId } : {}),
      ...(status && status !== "ALL" ? { status: status as never } : {}),
    },
    include: {
      lead: { include: { business: { select: { name: true, city: true, industry: true } } } },
      _count: { select: { findings: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  return json({ runs })
}
