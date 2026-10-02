/**
 * P12 — FULL RUNTIME TRACE of one real lead: source → query → job → content → business → lead → score → research → CRM → learning.
 */
import { q, phase, ev } from "./lib.mjs";

await phase("P12 FULL TRACE");
// pick a real lead created during this test window that has research + content lineage
const cand = await q(`SELECT l.id, l."createdAt", l.score, l.status, l.temperature, l."sourcePlatform", l."intentScore",
  l."fitScore", l."urgencyScore", l."confidenceScore", b.name, b.city, b.industry, b."websiteUrl", b.phone
  FROM "Lead" l LEFT JOIN "Business" b ON b.id=l."businessId"
  ORDER BY l."createdAt" DESC LIMIT 5`);
const L = cand.rows.find(r => r.name) ?? cand.rows[0];
const leadId = L.id;
ev("TRACE", `LEAD ${leadId} :: biz="${(L.name ?? "").slice(0, 50)}" city=${L.city ?? "-"} created=${L.createdAt?.toISOString?.() ?? L.createdAt} score=${L.score} status=${L.status} temp=${L.temperature}`);

// upstream: content item(s) that created this lead
const content = await q(`SELECT c.id, c."contentType", c."sourceId", c."collectedAt" AS "createdAt", LEFT(c.title, 60) AS title
  FROM "ContentItem" c JOIN "LeadContent" lc ON lc."contentId"=c.id WHERE lc."leadId"=$1 LIMIT 3`, [leadId]);
for (const c of content.rows) ev("TRACE", `↑ content ${c.id.slice(-6)} type=${c.contentType} at=${c.createdAt?.toISOString?.().slice(11, 19)} :: ${(c.title ?? "").replace(/\n/g, " ")}`);

// upstream: search job (query + providers)
const srcId = content.rows[0]?.sourceId;
if (srcId) {
  const src = await q(`SELECT id, name, type FROM "Source" WHERE id=$1`, [srcId]);
  ev("TRACE", `↑↑ source: ${src.rows[0]?.name ?? "?"} (${src.rows[0]?.type ?? "?"})`);
  const sj = await q(`SELECT id, query, status, "createdAt", "completedAt", LEFT(metadata::text, 200) AS meta FROM "SearchJob" WHERE "sourceId"=$1 AND "createdAt" <= $2 ORDER BY "createdAt" DESC LIMIT 1`, [srcId, content.rows[0]?.createdAt ?? new Date()]);
  for (const s of sj.rows) ev("TRACE", `↑↑ searchJob ${s.id.slice(-6)} query="${(s.query ?? "").slice(0, 50)}" status=${s.status} meta=${(s.meta ?? "").slice(0, 160)}`);
  const parentJob = await q(`SELECT id, type, status, "completedAt" FROM "Job" WHERE type='DISCOVERY' AND "completedAt" <= $2 AND id::text IN (SELECT id FROM "Job" WHERE type='DISCOVERY' ORDER BY "completedAt" DESC NULLS LAST LIMIT 40) ORDER BY "completedAt" DESC NULLS LAST LIMIT 1`, [srcId, content.rows[0]?.createdAt ?? new Date()]);
  for (const p of parentJob.rows) ev("TRACE", `↑↑↑ parent DISCOVERY job ${p.id.slice(-6)}/${p.status} completed=${p.completedAt?.toISOString?.().slice(11, 19)} (linked by sourceId+time window — no direct FK)`);
}

// research + findings
const runs = await q(`SELECT id, depth, status, "createdAt", "completedAt" FROM "ResearchRun" WHERE "leadId"=$1 ORDER BY "createdAt" DESC LIMIT 2`, [leadId]);
for (const r of runs.rows) ev("TRACE", `→ research ${r.id.slice(-6)} depth=${r.depth} status=${r.status} ${r.createdAt?.toISOString?.().slice(11, 19)}→${r.completedAt?.toISOString?.().slice(11, 19) ?? "-"}`);
const findings = await q(`SELECT f."type", LEFT(f."content", 80) AS content FROM "Finding" f JOIN "ResearchRun" r ON r.id=f."researchRunId" WHERE r."leadId"=$1 LIMIT 4`, [leadId]);
for (const f of findings.rows) ev("TRACE", `→ finding [${f.type}] ${(f.content ?? "").replace(/\n/g, " ").slice(0, 70)}`);

// CRM linkage: pipeline / tasks / conversations
const tasks = await q(`SELECT id, title, status FROM "Task" WHERE "leadId"=$1 LIMIT 3`, [leadId]);
for (const t of tasks.rows) ev("TRACE", `→ CRM task ${(t.title ?? "").slice(0, 50)} [${t.status}]`);
const conv = await q(`SELECT id, status, channel FROM "Conversation" WHERE "leadId"=$1 LIMIT 2`, [leadId]);
for (const c of conv.rows) ev("TRACE", `→ zizo conversation ${c.id.slice(-6)} [${c.status}] channel=${c.channel}`);

// learning linkage: insights mentioning this lead/query family
const insights = await q(`SELECT kind, LEFT(pattern, 50) AS pattern FROM "AgentInsight" WHERE "workspaceId"=(SELECT "workspaceId" FROM "Lead" WHERE id=$1) ORDER BY "createdAt" DESC LIMIT 3`, [leadId]);
for (const i of insights.rows) ev("TRACE", `→ learning insight [${i.kind}] ${(i.pattern ?? "").slice(0, 45)}`);
process.exit(0);
