// Task 19 — تحقق: بوستات الجروبات الجديدة + الليدز اللي اتولدت منها
import { PrismaClient } from "@prisma/client"
const url = (await import("fs")).readFileSync("/tmp/neon_url", "utf8").trim()
const db = new PrismaClient({ datasources: { db: { url } } })

try {
  // 1) حالة الوظيفة المحقونة
  const j = await db.job.findUnique({ where: { id: "cmu0g75tm0001nu820z08ql9h" }, select: { status: true, result: true } })
  console.log("الوظيفة المحقونة:", JSON.stringify(j?.result ?? j?.status))

  // 2) محتوى FACEBOOK_GROUPS الجديد (آخر 3 ساعات)
  const items = await db.contentItem.findMany({
    where: { rawData: { path: ["platform"], equals: "FACEBOOK_GROUPS" }, collectedAt: { gte: new Date(Date.now() - 3 * 3600e3) } },
    select: { title: true, canonicalUrl: true, collectedAt: true, id: true },
    orderBy: { collectedAt: "desc" },
    take: 20,
  })
  console.log(`\nبوستات جروبات (FACEBOOK_GROUPS): ${items.length}`)
  for (const i of items) console.log(" •", (i.title ?? "").slice(0, 70), "→", i.canonicalUrl?.slice(0, 70))

  // 3) الليدز الجديدة النهاردة من سوشيال
  const leads = await db.lead.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 3 * 3600e3) } },
    select: { id: true, status: true, score: true, summary: true, leadSourceType: true, business: { select: { name: true, mapsUrl: true, websiteUrl: true } } },
    orderBy: { createdAt: "desc" },
  })
  console.log(`\nليدز جديدة (آخر 3 ساعات): ${leads.length}`)
  for (const l of leads) {
    const u = l.business?.mapsUrl || l.business?.websiteUrl || ""
    const isGroup = /facebook\.com\/groups/.test(u)
    console.log(` ${isGroup ? "🔥جروب" : "   "} [${l.leadSourceType}] ${l.business?.name?.slice(0, 45)} | score=${l.score} | ${u.slice(0, 60)}`)
  }
} finally { await db.$disconnect() }
