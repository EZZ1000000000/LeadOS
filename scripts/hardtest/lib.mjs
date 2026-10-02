/**
 * LeadOS HARD RUNTIME TEST — shared lib.
 * Source of truth: production DB (Neon) + production runtime (Vercel).
 * No secrets printed. Evidence lines: [EVIDENCE] ...
 */
import fs from "node:fs";
import pg from "pg";

export const BASE = "https://leados-olive.vercel.app";
const EV_FILE = "/home/z/my-project/scripts/hardtest/evidence.md";

let _url = "";
for (const line of fs.readFileSync("/home/z/my-project/.env.prod-runtime", "utf8").split("\n")) {
  const m = line.match(/^DATABASE_URL=(.*)$/);
  if (m) { _url = m[1].trim().replace(/^"|"$/g, ""); break; }
}
export const db = new pg.Pool({ connectionString: _url, ssl: { rejectUnauthorized: false }, max: 8 });
export async function q(sql, params = []) {
  return db.query(sql, params);
}
export function envUrl() { return _url; }

export function ev(tag, msg) {
  const line = `[EVIDENCE][${tag}] ${msg}`;
  console.log(line);
  fs.appendFileSync(EV_FILE, line + "\n");
}
export function phase(name) {
  const line = `\n===== ${name} =====`;
  console.log(line);
  fs.appendFileSync(EV_FILE, line + "\n");
}

export async function login(email = "admin@leados.com", pw = "admin123") {
  const r = await fetch(BASE + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pw }),
  });
  const setCookie = r.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0];
  if (!r.ok || !cookie) throw new Error("login failed: " + r.status);
  return cookie;
}

export async function api(cookie, path, opts = {}) {
  const t0 = Date.now();
  const r = await fetch(BASE + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}), ...(opts.headers ?? {}) },
  });
  const ms = Date.now() - t0;
  let body = null;
  try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body, ms };
}

export async function tick(cookie, max = 5, extra = "") {
  const { status, body, ms } = await api(cookie, `/api/cron/tick?max=${max}${extra}`, { method: "POST" });
  return { status, body, ms };
}

export const WS_ID = "cmuflg0190001mzaergkpgrze";

export async function snapshot() {
  const one = async (label, sql) => {
    const r = await q(sql);
    return [label, Number(Object.values(r.rows[0])[0])];
  };
  const pairs = await Promise.all([
    one("leads", `SELECT COUNT(*) FROM "Lead"`),
    one("businesses", `SELECT COUNT(*) FROM "Business"`),
    one("content_items", `SELECT COUNT(*) FROM "ContentItem"`),
    one("group_posts", `SELECT COUNT(*) FROM "GroupPost"`),
    one("jobs_total", `SELECT COUNT(*) FROM "Job"`),
    one("jobs_queued", `SELECT COUNT(*) FROM "Job" WHERE status='QUEUED'`),
    one("jobs_running", `SELECT COUNT(*) FROM "Job" WHERE status='RUNNING'`),
    one("jobs_retrying", `SELECT COUNT(*) FROM "Job" WHERE status='RETRYING'`),
    one("jobs_waiting_cap", `SELECT COUNT(*) FROM "Job" WHERE status='WAITING_FOR_CAPABILITY'`),
    one("jobs_failed", `SELECT COUNT(*) FROM "Job" WHERE status='FAILED'`),
    one("jobs_success", `SELECT COUNT(*) FROM "Job" WHERE status='SUCCESS'`),
    one("research_runs", `SELECT COUNT(*) FROM "ResearchRun"`),
    one("research_completed", `SELECT COUNT(*) FROM "ResearchRun" WHERE status='COMPLETED'`),
    one("findings", `SELECT COUNT(*) FROM "Finding"`),
    one("search_jobs", `SELECT COUNT(*) FROM "SearchJob"`),
    one("search_memories", `SELECT COUNT(*) FROM "SearchMemory"`),
    one("git_skills", `SELECT COUNT(*) FROM "GitSkill"`),
    one("skill_stats", `SELECT COUNT(*) FROM "SkillStat"`),
    one("skill_lessons", `SELECT COUNT(*) FROM "SkillLesson"`),
    one("agent_runs", `SELECT COUNT(*) FROM "AgentRun"`),
    one("agent_steps", `SELECT COUNT(*) FROM "AgentStep"`),
    one("agent_insights", `SELECT COUNT(*) FROM "AgentInsight"`),
    one("tasks", `SELECT COUNT(*) FROM "Task"`),
    one("alerts", `SELECT COUNT(*) FROM "Alert"`),
    one("conversations", `SELECT COUNT(*) FROM "Conversation"`),
    one("messages", `SELECT COUNT(*) FROM "Message"`),
    one("tactic_stats", `SELECT COUNT(*) FROM "TacticStat"`),
    one("evolution_proposals", `SELECT COUNT(*) FROM "EvolutionProposal"`),
    one("sequence_enrollments", `SELECT COUNT(*) FROM "SequenceEnrollment"`),
    one("monitored_groups", `SELECT COUNT(*) FROM "MonitoredGroup"`),
    one("sources_active", `SELECT COUNT(*) FROM "Source" WHERE status='ACTIVE'`),
  ]);
  return Object.fromEntries(pairs);
}

export function printSnap(s, title = "snapshot") {
  const line = Object.entries(s).map(([k, v]) => `${k}=${v}`).join(" ");
  ev("SNAP", `${title}: ${line}`);
}

export function delta(before, after) {
  const out = [];
  for (const k of Object.keys(before)) {
    const d = after[k] - before[k];
    if (d !== 0) out.push(`${k}: ${before[k]}→${after[k]} (${d >= 0 ? "+" : ""}${d})`);
  }
  return out;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
