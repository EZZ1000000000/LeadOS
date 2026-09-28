// فحص نتايج طبقة سرقة إعلانات المنافسين الممولة (sponsored + بيكسلات)
import { PrismaClient } from "@prisma/client"

const envFile = (await import("fs")).readFileSync("/home/z/my-project/.env.prod-check", "utf8")
const url = envFile.match(/DATABASE_URL="(postgresql:\/\/[^"]+)"/)?.[1]
if (!url) { console.error("NO DB URL"); process.exit(1) }
const db = new PrismaClient({ datasources: { db: { url } } })

try {
  // آخر جوبات بحث — الليدها الإعلانية والمنافسين
  const jobs = await db.searchJob.findMany({
    orderBy: { completedAt: "desc" },
    take: 5,
    select: { completedAt: true, resultCount: true, query: true, metadata: true },
  })
  console.log("═ آخر جوبات بحث:")
  for (const j of jobs) {
    const m = (j.metadata ?? {}) as { competitorAdChannels?: Array<{ name: string; channels: string[] }>; byType?: Record<string, number> }
    const ads = m.competitorAdChannels?.length ? ` 🎯 منافسين بإعلانات حية: ${m.competitorAdChannels.map((c) => `${c.name}[${c.channels.join("+")}]`).join(", ")}` : ""
    console.log(`  ${j.completedAt?.toISOString?.().slice(5, 16)}  results=${j.resultCount}${ads}`)
  }

  // ليدز AD_SPENDER — إجمالي + آخر 8
  const total = await db.lead.count({ where: { intentSignal: "AD_SPENDER" } })
  console.log(`\n═ ليدز «بيصرفوا إعلانات» (AD_SPENDER): ${total}`)
  const recent = await db.lead.findMany({
    where: { intentSignal: "AD_SPENDER" },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      createdAt: true, intentSignal: true, score: true, metadata: true,
      business: { select: { name: true, websiteUrl: true } },
    },
  })
  for (const l of recent) {
    const m = (l.metadata ?? {}) as { adChannels?: string[]; adEvidence?: string; adSite?: string }
    const ev = m.adChannels?.length ? ` 📡 ${m.adChannels.join("+")} (${m.adEvidence ?? "scan"})` : ""
    console.log(`  • ${l.business?.name?.slice(0, 45)} — score ${l.score}${ev} ${l.createdAt.toISOString().slice(5, 16)}`)
  }

  // إجمالي الليدز
  const all = await db.lead.count()
  console.log(`\n═ إجمالي الليدز: ${all}`)
} finally {
  await db.$disconnect()
}
