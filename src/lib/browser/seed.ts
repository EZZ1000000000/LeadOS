// LeadOS — بذر جوبات BROWSER_SCAN: وقود الجيل القادم من المتصفحات (طلب §16 + §18 + §23)
// النبضة (tick) تبذر جوبات المنصات المستحقة — الـrunner في GitHub Actions يستهلكها في جيل واحد طويل الحياة.
// الحماية من انفجار الطابور: دفعة واحدة في الطيران لكل منصة (§19) + سقف جوبات من السياسة.
import { db } from "@/lib/db"
import { policyFor, allPolicies } from "./policy"

const SCAN_COOLDOWN_MS = 15 * 60 * 1000 // نفس cooldown المسح الحالي — لا مسح مزدوج

export interface SeedResult { seeded: number; perPlatform: Record<string, number>; notes: string[] }

/** هل للمنصة جوبة حية بالفعل في الطابور؟ — دفعة واحدة في الطيران لكل منصة (تصفية JS متوافقة) */
async function hasLiveJob(workspaceId: string, platform: string): Promise<boolean> {
  const candidates = await db.job.findMany({
    where: {
      workspaceId, type: "BROWSER_SCAN",
      status: { in: ["QUEUED", "RETRYING", "RUNNING"] },
    },
    select: { payload: true },
    take: 50,
  })
  return candidates.some((j) => (j.payload as { platform?: string } | null)?.platform === platform)
}

/** بذر جوبات المسح/الرادار للمنصات المؤهلة — يُستدعى من النبضة (processTick) */
export async function seedBrowserScanJobs(): Promise<SeedResult> {
  const result: SeedResult = { seeded: 0, perPlatform: {}, notes: [] }
  const ws = await db.workspace.findFirst({ where: { isActive: true }, select: { id: true }, orderBy: { createdAt: "asc" } })
  if (!ws) return result

  for (const policy of allPolicies()) {
    const scanJobs = policy.browserJobs.filter((t) => t === "GROUPS_SCAN" || t === "RADAR_SCAN")
    if (!scanJobs.length || policy.maxConcurrentBrowsers === 0) continue
    if (await hasLiveJob(ws.id, policy.platform)) continue

    // جروبات مستحقة: نشطة + لم تُمسح خلال cooldown
    const due = await db.monitoredGroup.findMany({
      where: {
        workspaceId: ws.id, platform: policy.platform,
        status: { in: ["ACTIVE", "NEEDS_SESSION"] },
        OR: [{ lastScannedAt: null }, { lastScannedAt: { lt: new Date(Date.now() - SCAN_COOLDOWN_MS) } }],
      },
      orderBy: [{ activityScore: "desc" }, { lastScannedAt: "asc" }],
      take: Math.min(policy.maxJobsPerGeneration, 6),
    })
    if (!due.length) continue

    const perBatch = Math.min(due.length, policy.maxJobsPerGeneration)
    const halfRadar = scanJobs.includes("RADAR_SCAN") ? Math.max(1, Math.floor(perBatch / 3)) : 0
    for (let i = 0; i < perBatch; i++) {
      const g = due[i]
      const task = i < halfRadar ? "RADAR_SCAN" : "GROUPS_SCAN"
      const sessionRequired = policy.sessionRequiredJobs.includes(task as never)
      await db.job.create({
        data: {
          workspaceId: ws.id,
          type: "BROWSER_SCAN",
          priority: task === "RADAR_SCAN" ? 75 : 60, // الرادار أشد استعجالًا (منشورات عمرها دقايق)
          payload: {
            platform: policy.platform, task,
            groupId: g.id, groupExternalId: g.externalId, groupUrl: g.url, groupName: g.name,
            sessionRequired,
            seededBy: "browser-runtime-seed",
          } as never,
        },
      })
      result.seeded++
      result.perPlatform[policy.platform] = (result.perPlatform[policy.platform] ?? 0) + 1
    }
  }
  if (result.seeded) result.notes.push(`تم بذر ${result.seeded} جوبة متصفح — دفعة واحدة لكل منصة`)
  return result
}

/** بذر PUBLIC_FETCH على طلب — للأدوات الأخرى (الأيجنت/القواعد) — آمن ومكرر مع externalId مستقر */
export async function seedPublicFetchJob(workspaceId: string, platform: string, url: string, priority = 40): Promise<string | null> {
  const policy = policyFor(platform)
  if (!policy || !policy.browserJobs.includes("PUBLIC_FETCH")) return null
  const job = await db.job.create({
    data: {
      workspaceId, type: "BROWSER_SCAN", priority,
      payload: { platform, task: "PUBLIC_FETCH", url, sessionRequired: false, seededBy: "manual" } as never,
    },
  })
  return job.id
}
