import { db } from "@/lib/db"
import { json, requireAuth, isResponse } from "@/lib/api-helpers"
import { aiProviderStatus } from "@/lib/ai"

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { user, workspace } = auth
  const memberCount = await db.workspaceMember.count({ where: { workspaceId: workspace.id } })
  return json({
    user,
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
    memberCount,
    ai: aiProviderStatus(),
  })
}
