import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const total = await db.lead.count();
  const byType = await db.lead.groupBy({ by: ['leadSourceType'], _count: { _all: true } });
  const byStatus = await db.lead.groupBy({ by: ['status'], _count: { _all: true } });
  const platforms: Record<string, number> = {};
  const leads = await db.lead.findMany({ select: { metadata: true, createdAt: true, leadSourceType: true }, orderBy: { createdAt: 'desc' } });
  for (const l of leads) {
    const m = (l.metadata || {}) as any;
    const p = m.platform || m.source || 'unknown';
    platforms[p] = (platforms[p] || 0) + 1;
  }
  console.log('TOTAL LEADS:', total);
  console.log('\nBY leadSourceType:', byType.map(t=>`${t.leadSourceType}: ${t._count._all}`).join(' | '));
  console.log('\nBY STATUS:', byStatus.map(t=>`${t.status}: ${t._count._all}`).join(' | '));
  console.log('\nBY PLATFORM (from metadata):', JSON.stringify(platforms, null, 1));
  const items = await (db as any).discoveredItem.groupBy({ by: ['platform'], _count: { _all: true } }).catch(()=>null);
  if (items) console.log('\nDISCOVERED ITEMS BY PLATFORM:', items.map((t:any)=>`${t.platform}: ${t._count._all}`).join(' | '));
  const itemsToday = await (db as any).discoveredItem.count({ where: { createdAt: { gte: new Date(Date.now() - 24*3600*1000) } } }).catch(()=>0);
  console.log('\nDISCOVERED ITEMS last 24h:', itemsToday);
  const leadsLast24 = await db.lead.count({ where: { createdAt: { gte: new Date(Date.now() - 24*3600*1000) } } });
  console.log('LEADS created last 24h:', leadsLast24);
  const newest = await db.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, createdAt: true, metadata: true } });
  console.log('\nNEWEST 5:', newest.map(n => `${n.createdAt.toISOString()} | ${(n.metadata as any)?.platform} | ${(n.metadata as any)?.title || n.id}`).join('\n'));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
