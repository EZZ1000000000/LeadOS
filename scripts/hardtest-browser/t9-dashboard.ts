// T9 — تطابق اللوحة مع قاعدة البيانات (§38): كل رقم في /api/browser/control == الواقع في DB
import { db, ok, record, adminCookie, controlData } from "./lib"

async function main() {
  const cookie = await adminCookie()
  const { status, body } = await controlData(cookie)
  const wsId = (await db.workspace.findFirst())!.id

  // إجماليات DB
  const dbActive = await db.browserRuntime.count({ where: { workspaceId: wsId, status: { in: ["STARTING", "READY", "BUSY", "IDLE", "RECOVERING"] } } })
  const dbClosed = await db.browserRuntime.count({ where: { workspaceId: wsId, status: "CLOSED" } })
  const dbEvents = await db.browserEvent.count({ where: { workspaceId: wsId } })
  const dbSessionRows = await db.browserSessionState.count({ where: { workspaceId: wsId } })

  const platforms = (body?.platforms ?? []) as Array<{ platform: string; browsers: { count: number }; session: { status: string } }>
  const h = body?.health ?? {}

  // تطابق لكل منصة: browsers.count من اللوحة == DB
  let platformMatch = true
  const mismatches: string[] = []
  for (const p of platforms) {
    const cnt = await db.browserRuntime.count({ where: { workspaceId: wsId, platform: p.platform } })
    if (cnt !== p.browsers.count) { platformMatch = false; mismatches.push(`${p.platform}: panel=${p.browsers.count} db=${cnt}`) }
  }
  const jinaRows = (body?.jina ?? []) as Array<{ day: string; requests: number }>
  let jinaMatch = true
  for (const j of jinaRows) {
    const dbJina = await db.jinaMetric.findUnique({ where: { workspaceId_day: { workspaceId: wsId, day: j.day } } })
    if (dbJina?.requestCount !== j.requests) jinaMatch = false
  }

  record("T9: تطابق اللوحة مع DB", [
    `control status=${status}`,
    `platforms=${platforms.length} (10 متوقع)`,
    `health.activeBrowsers=${h.activeBrowsers} == DB active=${dbActive}`,
    `mismatches=${mismatches.length ? mismatches.join(", ") : "لا شيء"}`,
    `jina rows=${jinaRows.length} jinaMatch=${jinaMatch}`,
    `dbEvents=${dbEvents} dbClosedRuntimes=${dbClosed} sessionRows=${dbSessionRows}`,
  ].join("\n  "))

  const c1 = ok("T9: اللوحة ترد 200 وتعرض 10 منصات", status === 200 && platforms.length === 10)
  const c2 = ok("T9: عدّاد المتصفحات لكل منصة مطابق للـDB", platformMatch, mismatches.join(", ") || "تطابق كامل")
  const c3 = ok("T9: health.activeBrowsers مطابق", h.activeBrowsers === dbActive, `${h.activeBrowsers} vs ${dbActive}`)
  const c4 = ok("T9: Jina في اللوحة == Jina في DB", jinaMatch)
  const serialized = JSON.stringify(body ?? {})
  const noLeak = !serialized.includes("storageCipher") && !serialized.includes("storageState") && !serialized.includes("cookieHeader")
  const c5 = ok("T9: لا تسريب أسرار — الرد يحمل حالات وأرقامًا فقط", noLeak, "لا حقول تخزين/كوكيز في الرد")

  process.exit(c1 && c2 && c3 && c4 && c5 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
