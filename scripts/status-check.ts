import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
  });
  console.log("=== USERS ===");
  for (const u of users) console.log(`${u.email} | ${u.name} | ${u.id}`);

  const workspaces = await prisma.workspace.findMany({
    select: { id: true, name: true, slug: true, createdAt: true },
  });
  console.log("\n=== WORKSPACES ===");
  for (const w of workspaces) {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: w.id },
      include: { user: { select: { email: true, role: true } } },
    });
    console.log(`\n[${w.name}] slug=${w.slug} id=${w.id}`);
    for (const m of members) console.log(`  member: ${m.user.email} (${m.role})`);

    const leads = await prisma.lead.count({ where: { workspaceId: w.id } });
    const businesses = await prisma.business.count({ where: { workspaceId: w.id } });
    const sources = await prisma.source.count({ where: { workspaceId: w.id } });
    const contents = await prisma.contentItem.count({ where: { workspaceId: w.id } });
    const rules = await prisma.searchRule.count({ where: { workspaceId: w.id } });
    const tasks = await prisma.task.count({ where: { workspaceId: w.id } });
    const pipelines = await prisma.pipeline.count({ where: { workspaceId: w.id } });
    const agentRuns = await prisma.agentRun.count({ where: { workspaceId: w.id } });
    const researchRuns = await prisma.researchRun.count({ where: { workspaceId: w.id } });
    console.log(`  leads=${leads} businesses=${businesses} sources=${sources} rules=${rules} contents=${contents} tasks=${tasks} pipelines=${pipelines} agentRuns=${agentRuns} researchRuns=${researchRuns}`);

    if (sources > 0) {
      const ss = await prisma.source.findMany({
        where: { workspaceId: w.id },
        select: { name: true, type: true, status: true },
      });
      for (const s of ss) console.log(`    source: ${s.name} | ${s.type} | ${s.status}`);
    }
    if (rules > 0) {
      const rs = await prisma.searchRule.findMany({
        where: { workspaceId: w.id },
        select: { name: true, enabled: true, keywords: true, industries: true, sourceTypes: true },
      });
      for (const r of rs) console.log(`    rule: ${r.name} | enabled=${r.enabled} | industries=${JSON.stringify(r.industries)} | sourceTypes=${JSON.stringify(r.sourceTypes)}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
