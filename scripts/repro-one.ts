/** Print FULL error for one simple query against Neon via Prisma. */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  try {
    const n = await db.alert.count();
    console.log("OK alert.count =", n);
  } catch (e) {
    console.log("FULL ERROR:");
    console.log(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
    const anyE = e as { code?: string; meta?: unknown; clientVersion?: string };
    console.log("code:", anyE.code, "clientVersion:", anyE.clientVersion, "meta:", JSON.stringify(anyE.meta));
  } finally {
    await db.$disconnect();
  }
}

main();
