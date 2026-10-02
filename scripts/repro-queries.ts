/**
 * Reproduce the exact Prisma queries the broken dashboard routes run,
 * directly against Neon production, and print the real errors.
 * READ-ONLY: only findMany / count.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const wsId = "cmuflg0190001mzaergkpgrze"; // from /api/me response

async function tryq(label: string, fn: () => Promise<unknown>) {
  try {
    const r = await fn();
    const n = Array.isArray(r) ? r.length : typeof r;
    console.log(`OK   ${label}  (${n})`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`FAIL ${label}`);
    console.log("     " + msg.split("\n").slice(0, 4).join("\n     "));
  }
}

async function main() {
  await tryq("lead.findMany (leads route)", () =>
    db.lead.findMany({
      where: { workspaceId: wsId },
      include: {
        business: { select: { name: true, city: true, industry: true, category: true, rating: true, reviewCount: true, phone: true, websiteUrl: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" as const },
      take: 3,
    })
  );

  await tryq("lead.count HOT (overview)", () =>
    db.lead.count({ where: { workspaceId: wsId, temperature: "HOT" as never } })
  );

  await tryq("researchRun.count RUNNING/QUEUED (overview)", () =>
    db.researchRun.count({ where: { workspaceId: wsId, status: { in: ["RUNNING", "QUEUED"] as never } } })
  );

  await tryq("task.findMany (tasks route)", () =>
    db.task.findMany({ where: { workspaceId: wsId }, orderBy: { createdAt: "desc" as const }, take: 3 })
  );

  await tryq("task.count (overview)", () =>
    db.task.count({ where: { workspaceId: wsId, status: { notIn: ["DONE", "CANCELLED"] as never } } })
  );

  await tryq("alert.count unread (overview)", () =>
    db.alert.count({ where: { workspaceId: wsId, isRead: false } })
  );

  await tryq("source.count active (overview)", () =>
    db.source.count({ where: { workspaceId: wsId, status: "ACTIVE" as never } })
  );

  await tryq("lead.count total (overview)", () => db.lead.count({ where: { workspaceId: wsId } }));

  await tryq("researchRun.findMany (research route)", () =>
    db.researchRun.findMany({ where: { workspaceId: wsId }, orderBy: { createdAt: "desc" as const }, take: 3 })
  );

  await tryq("sequence.findMany (sequences route)", () =>
    (db as unknown as { sequence: { findMany: (a: unknown) => Promise<unknown> } }).sequence?.findMany?.({ take: 1 }) ??
    Promise.reject(new Error("no sequence model in client"))
  );

  await tryq("experiment.findMany (experiments route)", () =>
    (db as unknown as { experiment: { findMany: (a: unknown) => Promise<unknown> } }).experiment?.findMany?.({ take: 1 }) ??
    Promise.reject(new Error("no experiment model in client"))
  );

  await tryq("aiRun.findMany SKILL types (skills route)", () =>
    db.aiRun.findMany({ where: { workspaceId: wsId, type: { in: ["SKILL_QUERIES", "SKILL_SELECT"] as never } }, take: 3 })
  );

  await tryq("lead.findMany feed (contentItem)", () =>
    db.contentItem.findMany({ where: { workspaceId: wsId }, orderBy: { createdAt: "desc" as const }, take: 3 })
  );

  await tryq("pipeline.findMany (pipeline route)", () =>
    db.pipeline.findMany({ where: { workspaceId: wsId }, include: { stages: true } })
  );

  await tryq("agentRun entity (agent/entity)", () =>
    db.agentRun.findMany({ where: { workspaceId: wsId }, orderBy: { startedAt: "desc" as const }, take: 3 })
  );

  await db.$disconnect();
}

main();
