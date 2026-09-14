// اختبار حي: اكتشاف جروبات فيسبوك بالكلمات المفتاحية عبر Serper
import { discoverGroups } from "../src/lib/monitors/scan"
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  const ws = await db.workspace.findFirst({ select: { id: true } })
  if (!ws) { console.log("no workspace"); return }
  const result = await discoverGroups({
    workspaceId: ws.id,
    platform: "FACEBOOK",
    keywords: ["كافيهات مصر", "مقاهي القاهرة", "محتاج تسويق"],
    segment: "BOTH",
  })
  console.log(`created=${result.created.length} skipped=${result.skipped} note=${result.note ?? "-"}`)
  for (const g of result.created) {
    console.log(`  [${g.intentScore}] ${g.name} — ${g.url}`)
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
