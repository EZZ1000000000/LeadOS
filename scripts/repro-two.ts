/** Exact errors for contentItem + agentRun against Neon. */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const ws = "cmuflg0190001mzaergkpgrze";

async function t(label: string, fn: () => Promise<unknown>) {
  try {
    const r = await fn();
    console.log("OK", label, Array.isArray(r) ? r.length : "");
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).replace(/\s*\n\s*/g, " | ");
    console.log("FAIL", label, "::", msg.slice(-300));
  }
}

async function main() {
  await t("contentItem", () =>
    db.contentItem.findMany({ where: { workspaceId: ws }, orderBy: { createdAt: "desc" }, take: 2 })
  );
  await t("agentRun.entity", () =>
    db.agentRun.findMany({ where: { workspaceId: ws }, orderBy: { startedAt: "desc" }, take: 2 })
  );
  await db.$disconnect();
}

main();
