// LeadOS — تنظيف المهام العالقة + فحص تعافي z-ai search
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  // 1) تنظيف RUNNING الأقدم من 5 دقايق (عالقة من انفجار rate-limit)
  const stuck = await db.job.updateMany({
    where: { status: "RUNNING", updatedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
    data: { status: "FAILED", result: { error: "stale from rate-limit burst" } },
  })
  console.log("cleaned stuck jobs:", stuck.count)

  // 2) فحص z-ai search
  try {
    const { default: ZAI } = await import("z-ai-web-dev-sdk")
    const z = await ZAI.create()
    const r = (await z.functions.invoke("web_search", { query: "اصحاب مطاعم مصر", num: 5 })) as unknown[]
    console.log("z-ai RECOVERED:", Array.isArray(r) ? `${r.length} results` : "ok")
  } catch (e) {
    const m = /status (\d+)/.exec(String(e))
    console.log("STILL LIMITED:", m?.[1] ?? "unknown")
  }

  await db.$disconnect()
}

main()
