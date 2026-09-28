// اختبار end-to-end محلي: اكتشاف → ابتلاع → ماسح بيكسلات → AD_SPENDER
// بيكتب في قاعدة الإنتاج مباشرة (نفس ما الإنتاج يعمل) — بأصغر كمية ممكنة
import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"
config({ path: "/home/z/my-project/.env" })
config({ path: "/home/z/my-project/.env.prod-check", override: true })

import { runDiscovery, detectAdPixels } from "../src/lib/discovery.ts"
import { ingestDiscoveredItems } from "../src/lib/queue.ts"

const url = process.env.DATABASE_URL!
if (!url.includes("pooler")) { console.error("⚠ مش رابط الإنتاج!"); process.exit(1) }
const db = new PrismaClient({ datasources: { db: { url } } })

try {
  const ws = await db.workspace.findFirst({ select: { id: true } })
  const source = await db.source.findFirst({ where: { workspaceId: ws!.id, status: "ACTIVE" }, select: { id: true, type: true, name: true } })
  console.log(`ws=${ws!.id} source=${source!.name} (${source!.type})`)

  // 1) اكتشاف حقيقي — دليل أعمال (بيزنسات بمواقع)
  console.log("\n═ 1) الاكتشاف الحي (DIRECTORY)")
  const { items, adaptersUsed } = await runDiscovery(["DIRECTORY"], ["شركات تسويق الكتروني مصر"], 4)
  console.log(`   عناصر: ${items.length} | adapters: ${adaptersUsed.join(",")}`)
  for (const it of items.slice(0, 6)) console.log(`   • ${it.title.slice(0, 45)} → ${it.url.slice(0, 60)}`)

  // 2) فحص البيكسلات مباشرة على أقوى العناصر ذات المواقع
  console.log("\n═ 2) ماسح البيكسلات على العناصر ذات المواقع")
  let scanned = 0
  for (const it of items) {
    const site = (it.rawData as { website?: string })?.website
    if (!site || scanned >= 4) continue
    scanned++
    const channels = await detectAdPixels(site)
    console.log(`   ${site.replace(/^https?:\/\/(www\.)?/, "").slice(0, 35)}: ${channels.length ? "💰 " + channels.join("+") : "—"}`)
  }
  if (!scanned) console.log("   (مفيش مواقع في العناصر دي)")

  // 3) الابتلاع الكامل (فحص البيكسلات بيشتغل جواه)
  console.log("\n═ 3) الابتلاع (مع فحص البيكسلات)")
  const result = await ingestDiscoveredItems(ws!.id, source!, null, items.slice(0, 8), Date.now() + 60_000)
  console.log(`   created=${result.created} duplicates=${result.duplicates} adPixelLeads=${result.adPixelLeads}`)
  console.log(`   leadsByPlatform: ${JSON.stringify(result.leadsByPlatform)}`)
} finally {
  await db.$disconnect()
}
