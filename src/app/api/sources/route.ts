import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const sources = await db.source.findMany({
    where: { workspaceId: auth.workspace.id },
    include: { _count: { select: { contents: true, searchJobs: true } } },
    orderBy: { createdAt: "asc" },
  })
  return json({ sources })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = await readBody<{ name?: string; type?: string; scheduleCron?: string; config?: unknown }>(req)
  if (!body?.name || !body?.type) return jsonError("الاسم والنوع مطلوبان")
  const source = await db.source.create({
    data: {
      workspaceId: auth.workspace.id,
      name: body.name,
      type: body.type as never,
      scheduleCron: body.scheduleCron ?? "*/15 * * * *",
      config: (body.config ?? {}) as never,
    },
  })
  return json({ source }, 201)
}
