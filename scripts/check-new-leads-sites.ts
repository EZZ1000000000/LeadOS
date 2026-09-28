import { PrismaClient } from "@prisma/client"
const envFile = (await import("fs")).readFileSync("/home/z/my-project/.env.prod-check", "utf8")
const url = envFile.match(/DATABASE_URL="(postgresql:\/\/[^"]+)"/)?.[1]!
const db = new PrismaClient({ datasources: { db: { url } } })
try {
  const leads = await db.lead.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 45 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { createdAt: true, score: true, metadata: true, business: { select: { name: true, websiteUrl: true } } },
  })
  console.log(`ليدز آخر 45 دقيقة: ${leads.length}`)
  for (const l of leads) {
    const m = (l.metadata ?? {}) as { adChannels?: string[]; adEvidence?: string; platform?: string }
    const ev = m.adChannels?.length ? ` 💰${m.adChannels.join("+")}` : ""
    console.log(`  • ${(l.business?.name ?? "").slice(0, 38)} | site: ${l.business?.websiteUrl ? "✓" : "✗"} | ${l.business?.websiteUrl?.slice(8, 40) ?? "-"}${ev} [${m.platform ?? "?"}]`)
  }
} finally { await db.$disconnect() }
