// تحقق ما بعد النشر: أحدث الليدز + إحصائيات التقييم
import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()

async function main() {
  const ws = await db.workspace.findMany({ select: { id: true, name: true } })
  const ezz = ws.find((w) => w.name === "ezz")!

  console.log("== أحدث 12 ليد (بعد النشر) ==")
  const recent = await db.lead.findMany({
    where: { workspaceId: ezz.id }, orderBy: { createdAt: "desc" }, take: 12,
    select: { createdAt: true, leadSourceType: true, status: true, business: { select: { name: true, industry: true, rating: true, reviewCount: true, mapsUrl: true, websiteUrl: true } } },
  })
  for (const l of recent) {
    const b = l.business
    console.log(`- ${b.name.slice(0, 45)} | ${b.industry ?? "-"} | rate=${b.rating ?? "-"} (${b.reviewCount ?? 0}) | maps=${b.mapsUrl ? "✓" : "✗"} | site=${b.websiteUrl ? "✓" : "✗"} | ${l.leadSourceType}`)
  }

  const [total, withRating, withMaps] = await Promise.all([
    db.lead.count({ where: { workspaceId: ezz.id } }),
    db.business.count({ where: { workspaceId: ezz.id, rating: { not: null } } }),
    db.business.count({ where: { workspaceId: ezz.id, mapsUrl: { not: null } } }),
  ])
  console.log(`== إجمالي ezz: ${total} ليد | بتقييم: ${withRating} | برابط خريطة: ${withMaps} ==`)

  await db.$disconnect()
}
main().catch((e) => { console.error("ERR:", e.message); process.exit(1) })
