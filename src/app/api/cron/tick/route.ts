import { processTick } from "@/lib/queue"
import { getSessionUser } from "@/lib/auth"
import { json, jsonError } from "@/lib/api-helpers"

/**
 * Orchestrator tick endpoint — designed for external cron (cron-job.org / Vercel Cron).
 * Auth: `x-cron-secret` header or `?secret=` matching CRON_SECRET env, OR an authenticated session.
 * Keep maxJobs small so the endpoint finishes well inside serverless timeouts.
 */
async function handle(req: Request) {
  const url = new URL(req.url)
  const secret = process.env.CRON_SECRET
  const provided = req.headers.get("x-cron-secret") ?? url.searchParams.get("secret")
  const authorized = (secret && provided === secret) || Boolean(await getSessionUser())
  if (!authorized) return jsonError("غير مصرح", 401)

  const maxJobs = Math.min(10, Number(url.searchParams.get("max") ?? 5))
  const result = await processTick(maxJobs)
  return json({ ok: true, at: new Date().toISOString(), ...result })
}

export async function GET(req: Request) {
  return handle(req)
}

export async function POST(req: Request) {
  return handle(req)
}
