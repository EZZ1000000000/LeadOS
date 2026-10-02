/**
 * P2a — FARM → INGEST → CRM: real data through the real farm webhook (/api/ingest/webhook).
 * Data source: REAL discovered items already in DB (re-fed as a farm batch would send them).
 * Round 1: creation/duplicates. Round 2 (same batch): dedup proof — zero new leads.
 */
import { q, phase, ev, login, api } from "./lib.mjs";

await phase("P2a FARM→INGEST→CRM");
const cookie = await login();

// take real, recently discovered content-backed items
const items = await q(`SELECT b.name, b."websiteUrl" AS website, b.city, b.phone, b."mapsUrl" AS url
  FROM "Business" b WHERE b.name IS NOT NULL ORDER BY b."createdAt" DESC LIMIT 12`);
ev("P2a", `batch source: ${items.rows.length} REAL businesses from production DB (farm sends these as scraped items)`);
const batch = items.rows.map(r => ({ name: r.name, website: r.website ?? undefined, city: r.city ?? undefined, phone: r.phone ?? undefined, url: r.url ?? undefined }));

const r1 = await api(cookie, "/api/ingest/webhook", { method: "POST", body: JSON.stringify({ source: "Botasaurus Worker", platform: "FACEBOOK", items: batch }) });
ev("P2a", `webhook round1: status=${r1.status} reply=${JSON.stringify(r1.body).slice(0, 160)}`);

const r2 = await api(cookie, "/api/ingest/webhook", { method: "POST", body: JSON.stringify({ source: "Botasaurus Worker", platform: "FACEBOOK", items: batch }) });
ev("P2a", `webhook round2 (same batch): status=${r2.status} reply=${JSON.stringify(r2.body).slice(0, 160)}`);

const bad = await api(cookie, "/api/ingest/webhook", { method: "POST", body: JSON.stringify({ source: "Botasaurus Worker", platform: "NOT_A_PLATFORM", items: batch.slice(0, 2) }) });
ev("P2a", `invalid platform rejection: status=${bad.status} (expect 400) reply=${JSON.stringify(bad.body).slice(0, 100)}`);

const empty = await api(cookie, "/api/ingest/webhook", { method: "POST", body: JSON.stringify({ source: "Botasaurus Worker", platform: "FACEBOOK", items: [] }) });
ev("P2a", `empty batch: status=${empty.status} reply=${JSON.stringify(empty.body).slice(0, 100)}`);

const dupCheck = await q(`SELECT COUNT(*)::int AS c FROM "Business" b WHERE b."createdAt" > NOW() - INTERVAL '10 minutes'`);
ev("P2a", `businesses created in last 10min (all pipelines): ${dupCheck.rows[0].c}`);
process.exit(0);
