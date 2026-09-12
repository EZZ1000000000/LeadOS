import { db } from "@/lib/db"
import { json, requireAuth, isResponse } from "@/lib/api-helpers"
import { CONTENT_TYPE_LABELS, INTERACTION_TYPE_LABELS } from "@/lib/constants"

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const url = new URL(req.url)
  const limit = Math.min(80, Number(url.searchParams.get("limit") ?? 40))

  const [contents, activities] = await Promise.all([
    db.contentItem.findMany({
      where: { workspaceId: auth.workspace.id },
      include: { source: { select: { name: true, type: true } }, leadLinks: { select: { leadId: true } } },
      orderBy: { collectedAt: "desc" },
      take: limit,
    }),
    db.activity.findMany({
      where: { workspaceId: auth.workspace.id },
      include: { lead: { include: { business: { select: { name: true } } } }, user: { select: { name: true } } },
      orderBy: { occurredAt: "desc" },
      take: limit,
    }),
  ])

  const feed = [
    ...contents.map((c) => ({
      kind: "content" as const,
      id: c.id,
      at: c.collectedAt,
      title: c.title ?? "بدون عنوان",
      body: c.body?.slice(0, 220) ?? "",
      type: CONTENT_TYPE_LABELS[c.contentType] ?? c.contentType,
      sourceName: c.source?.name ?? "",
      sourceType: c.source?.type ?? "",
      url: c.canonicalUrl,
      status: c.status,
      leadId: c.leadLinks[0]?.leadId,
    })),
    ...activities.map((a) => ({
      kind: "activity" as const,
      id: a.id,
      at: a.occurredAt,
      title: `${INTERACTION_TYPE_LABELS[a.type] ?? a.type}${a.lead?.business?.name ? ` — ${a.lead.business.name}` : ""}`,
      body: a.body ?? a.subject ?? "",
      type: INTERACTION_TYPE_LABELS[a.type] ?? a.type,
      sourceName: a.user?.name ?? "النظام",
      sourceType: "",
      url: null,
      status: "",
      leadId: a.leadId,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit)

  return json({ feed })
}
