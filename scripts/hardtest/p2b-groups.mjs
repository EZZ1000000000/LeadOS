/**
 * P2b — FB GROUPS pipeline: scan → new posts → cooldown → only-new-on-rescan → no duplicate conversion.
 */
import { q, phase, ev, login, api, sleep } from "./lib.mjs";

await phase("P2b FB-GROUPS");
const cookie = await login();

const g0 = await q(`SELECT id, name, status, "lastScannedAt" FROM "MonitoredGroup" WHERE status IN ('ACTIVE','NEEDS_SESSION') ORDER BY "lastScannedAt" ASC NULLS FIRST LIMIT 4`);
for (const r of g0.rows) ev("P2b", `group ${r.id}: ${(r.name ?? "").slice(0, 40)} status=${r.status} lastScan=${r.lastScannedAt?.toISOString?.().slice(11, 19) ?? "never"}`);

const postsBefore = (await q(`SELECT COUNT(*)::int AS c FROM "GroupPost"`)).rows[0].c;
const s1 = await api(cookie, "/api/groups/scan", { method: "POST", body: JSON.stringify({ limit: 2 }) });
ev("P2b", `scan#1: status=${s1.status} reply=${JSON.stringify(s1.body).slice(0, 300)}`);
await sleep(4000);
const postsAfter = (await q(`SELECT COUNT(*)::int AS c FROM "GroupPost"`)).rows[0].c;
ev("P2b", `group_posts: ${postsBefore}→${postsAfter} (+${postsAfter - postsBefore})`);

// immediate rescan → cooldown should block or produce zero new
const s2 = await api(cookie, "/api/groups/scan", { method: "POST", body: JSON.stringify({ limit: 2 }) });
ev("P2b", `scan#2 (cooldown): status=${s2.status} reply=${JSON.stringify(s2.body).slice(0, 300)}`);

const dupPosts = await q(`SELECT COUNT(*)::int AS c FROM (SELECT "externalId" FROM "GroupPost" GROUP BY 1 HAVING COUNT(*) > 1) x`);
ev("P2b", `duplicate GroupPost externalIds: ${dupPosts.rows[0].c} (expect 0 — no re-conversion)`);

// conversion linkage
const conv = await q(`SELECT COUNT(*)::int AS c FROM "ContentItem" WHERE "contentType"='POST' AND "groupId" IS NOT NULL`).catch(() => null);
const leadFromPosts = await q(`SELECT COUNT(DISTINCT l.id)::int AS c FROM "Lead" l JOIN "LeadContent" lc ON lc."leadId"=l.id JOIN "ContentItem" ci ON ci.id=lc."contentId" WHERE ci."contentType"='POST'`).catch(() => null);
if (leadFromPosts) ev("P2b", `leads linked to group-post content: ${leadFromPosts.rows[0].c}`);
process.exit(0);
