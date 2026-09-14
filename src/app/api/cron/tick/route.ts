import { processTick } from "@/lib/queue"
import { getSessionUser } from "@/lib/auth"
import { json, jsonError } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { scanDueGroups } from "@/lib/monitors/scan"

/**
 * Orchestrator tick endpoint — designed for external cron (cron-job.org / Vercel Cron).
 * Auth: `x-cron-secret` header, `Authorization: Bearer <CRON_SECRET>` (Vercel Cron),
 * `?secret=` matching CRON_SECRET env, OR an authenticated session.
 * Keep maxJobs small so the endpoint finishes well inside serverless timeouts.
 * منذ إضافة «تحدي الجروبات»: نفس النبضة بتمسح كمان لحد 2 جروبات مستحقة.
 */
async function handle(req: Request) {
  const url = new URL(req.url)
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization") ?? ""
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null
  const provided = req.headers.get("x-cron-secret") ?? bearer ?? url.searchParams.get("secret")
  const authorized = (secret && provided === secret) || Boolean(await getSessionUser())
  if (!authorized) return jsonError("غير مصرح", 401)

  const maxJobs = Math.min(10, Number(url.searchParams.get("max") ?? 5))
  const result = await processTick(maxJobs)

  // تحدي الجروبات: مسح مستحقين (cooldown 15 دقيقة بيمنع التكرار)
  let groupScan: { scanned: number; newPosts: number; details: string[] } | null = null
  try {
    const wsIds = await db.monitoredGroup.findMany({
      where: { status: { in: ["ACTIVE", "NEEDS_SESSION"] } },
      select: { workspaceId: true },
      distinct: ["workspaceId"],
      take: 2,
    })
    const details: string[] = []
    let scanned = 0
    let newPosts = 0
    for (const w of wsIds) {
      const outcomes = await scanDueGroups(w.workspaceId, 2)
      for (const o of outcomes) {
        scanned++
        newPosts += o.newPosts
        details.push(`${o.name}: ${o.newPosts} جديد (${o.status})`)
      }
    }
    groupScan = { scanned, newPosts, details }
  } catch (err) {
    groupScan = { scanned: 0, newPosts: 0, details: [`group scan error: ${err instanceof Error ? err.message.slice(0, 100) : "خطأ"}`] }
  }

  return json({ ok: true, at: new Date().toISOString(), ...result, groupScan })
}

export async function GET(req: Request) {
  return handle(req)
}

export async function POST(req: Request) {
  return handle(req)
}
