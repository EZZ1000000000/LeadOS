import { scanGroup } from "../src/lib/monitors/scan"
import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()
async function main() {
  const g = await db.monitoredGroup.findFirst({ where: { platform: "FACEBOOK" } })
  if (!g) { console.log("no fb group"); return }
  const r = await scanGroup(g)
  console.log(JSON.stringify(r, null, 1))
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
