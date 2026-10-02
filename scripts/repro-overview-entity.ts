/** Reproduce overview + agent/entity GET queries exactly, post-sync. */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const wsId = "cmuflg0190001mzaergkpgrze";

async function t(label: string, fn: () => Promise<unknown>) {
  try {
    const r = await fn();
    const n = Array.isArray(r) ? r.length : (r && typeof r === "object" && "length" in (r as object) ? "*" : "");
    console.log("OK  ", label, n);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).replace(/\s*\n\s*/g, " | ");
    console.log("FAIL", label, "::", msg.slice(-240));
  }
}

async function main() {
  // --- /api/overview ---
  await t("ov: otLeads count HOT", () => db.lead.count({ where: { workspaceId: wsId, temperature: "HOT" as never } }));
  await t("ov: newLeads count NEW", () => db.lead.count({ where: { workspaceId: wsId, status: "NEW" as never } }));
  await t("ov: runningResearch", () => db.researchRun.count({ where: { workspaceId: wsId, status: { in: ["RUNNING", "QUEUED"] as never } } }));
  await t("ov: unreadAlerts", () => db.alert.count({ where: { workspaceId: wsId, isRead: false } }));
  await t("ov: dueTasks count", () => db.task.count({ where: { workspaceId: wsId, status: "TODO" as never } }));
  await t("ov: activeSources", () => db.source.count({ where: { workspaceId: wsId, status: "ACTIVE" as never } }));
  await t("ov: totalLeads", () => db.lead.count({ where: { workspaceId: wsId } }));
  await t("ov: totalJobs", () => db.job.count({ where: { workspaceId: wsId, status: { in: ["QUEUED", "RUNNING"] as never } } }));
  await t("ov: topLeads findMany", () => db.lead.findMany({
    where: { workspaceId: wsId },
    include: { business: { select: { name: true, city: true, industry: true } } },
    orderBy: { score: "desc" }, take: 5,
  }));
  await t("ov: recentAlerts", () => db.alert.findMany({ where: { workspaceId: wsId }, orderBy: { createdAt: "desc" }, take: 5 }));
  await t("ov: sources select", () => db.source.findMany({
    where: { workspaceId: wsId },
    select: { id: true, name: true, type: true, status: true, lastRunAt: true, lastError: true }, take: 8,
  }));
  await t("ov: recentJobs", () => db.job.findMany({
    where: { workspaceId: wsId }, orderBy: { createdAt: "desc" }, take: 6,
    select: { id: true, type: true, status: true, createdAt: true, result: true },
  }));
  await t("ov: upcomingTasks", () => db.task.findMany({
    where: { workspaceId: wsId, status: "TODO" as never },
    include: { lead: { include: { business: { select: { name: true } } } } },
    orderBy: { dueAt: "asc" }, take: 5,
  }));

  // --- /api/agent/entity GET ---
  await t("en: agentRun findFirst ENTITY", () => db.agentRun.findFirst({ where: { workspaceId: wsId, mode: "ENTITY" as never }, orderBy: { createdAt: "desc" } }));
  await t("en: agentStep findMany idx", () => db.agentStep.findMany({ where: { runId: "none" }, orderBy: { idx: "asc" }, take: 80 }));
  await t("en: agentInsight findMany", () => db.agentInsight.findMany({ where: { workspaceId: wsId }, orderBy: [{ weight: "desc" }, { createdAt: "desc" }], take: 10 }));
  await t("en: agentRun count", () => db.agentRun.count({ where: { workspaceId: wsId, mode: "ENTITY" as never } }));
  await t("en: agentRun aggregate leadsCreated", () => db.agentRun.aggregate({ where: { workspaceId: wsId, mode: "ENTITY" as never }, _sum: { leadsCreated: true } }));
  await t("en: searchMemory count", () => db.searchMemory.count({ where: { workspaceId: wsId } }));

  await db.$disconnect();
}

main();
