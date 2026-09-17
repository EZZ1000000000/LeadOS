// mint-and-wake.mjs — توكن dev + تفعيل ensureStealth عبر API (السيرفر يفتح خدمة Camoufox الجديدة كابن دائم)
import { createHmac } from "node:crypto"
import { DatabaseSync } from "node:sqlite"

// 1) user id من الداتابيز
const db = new DatabaseSync("/home/z/my-project/db/custom.db")
const row = db.prepare("SELECT id, email FROM User LIMIT 1").get()
if (!row?.id) { console.error("✗ لا يوجد مستخدم في الداتابيز"); process.exit(1) }
console.log("User:", row.id, row.email ?? "")

// 2) توكن HS256 (نفس auth.ts)
const b64url = (s) => Buffer.from(s).toString("base64url")
const SECRET = process.env.AUTH_SECRET || "leados-dev-secret-change-in-production"
const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
const body = b64url(JSON.stringify({ sub: row.id, exp: Math.floor(Date.now() / 1000) + 3600 }))
const sig = createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url")
const token = `${header}.${body}.${sig}`

// 3) action=goto → ensureStealth → spawnSidecar من عملية السيرفر الدائمة
const r = await fetch("http://localhost:3000/api/agent/browse", {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: `leados_session=${token}` },
  body: JSON.stringify({ action: "goto", url: "https://example.com/", timeout: 45000 }),
  signal: AbortSignal.timeout(150_000),
})
const j = await r.json().catch(() => ({}))
console.log("browse status:", r.status)
console.log("ok:", j.ok, "| url:", String(j.url ?? j.error ?? "").slice(0, 80), "| http:", j.http_status ?? "")
