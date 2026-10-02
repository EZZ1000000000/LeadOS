/** Real radarCycle invocation against production DB (runs inside P2d). */
import { radarCycle, RADAR_CONFIG } from "../../src/lib/radar";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const ws = (await db.workspace.findFirst({ where: { isActive: true }, select: { id: true } }))?.id;
  console.log(`radar cycle start ws=${ws} cooldown=${RADAR_CONFIG.groupCooldownMin}min groupsPerCycle=${RADAR_CONFIG.groupsPerCycle}`);
  const r = await radarCycle(ws);
  console.log(`radarCycle result: scanned=${r.scanned} instant=${r.instant} leads=${r.leads} scheduled=${r.scheduled}`);
  for (const n of r.commentNotes.slice(0, 4)) console.log(`note: ${n.slice(0, 120)}`);
  await db.$disconnect();
}

main().catch((e) => { console.error("radar error:", String(e?.message ?? e).slice(0, 200)); process.exit(1); });
