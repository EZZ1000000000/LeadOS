// Task 18 — توزيع الليدز الحقيقية على الإنتاج حسب منصة الاكتشاف (v2 بنفس أسماء الحقول الصحيحة)
import { PrismaClient } from "@prisma/client"

const url = (await import("fs")).readFileSync("/tmp/neon_url", "utf8").trim()
const db = new PrismaClient({ datasources: { db: { url } } })

try {
  const leads = await db.lead.findMany({
    select: { leadSourceType: true, business: { select: { mapsUrl: true, websiteUrl: true, name: true } } },
    take: 2000,
  })
  const src: Record<string, number> = {}
  const host: Record<string, number> = {}
  for (const l of leads) {
    src[l.leadSourceType] = (src[l.leadSourceType] ?? 0) + 1
    try {
      const u = l.business?.mapsUrl || l.business?.websiteUrl
      if (u) {
        const h = new URL(u).hostname.replace(/^www\./, "").split(".").slice(-2).join(".")
        host[h] = (host[h] ?? 0) + 1
      } else {
        host["(بدون رابط)"] = (host["(بدون رابط)"] ?? 0) + 1
      }
    } catch { host["(رابط غير صالح)"] = (host["(رابط غير صالح)"] ?? 0) + 1 }
  }
  console.log("إجمالي الليدز على الإنتاج:", leads.length)
  console.log("\nحسب نوع المصدر (leadSourceType):")
  for (const [k, v] of Object.entries(src).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`)
  console.log("\nحسب موقع المصدر (hostname):")
  for (const [k, v] of Object.entries(host).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${k}: ${v}`)
} finally {
  await db.$disconnect()
}
