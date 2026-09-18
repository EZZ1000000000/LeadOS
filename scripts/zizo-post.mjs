// zizo-post.mjs — استدعاء /api/agent/zizo بأفعال مختلفة (tick | status | ...)
// الاستخدام: node scripts/zizo-post.mjs tick
import { createHmac } from "node:crypto"
import { DatabaseSync } from "node:sqlite"

const db = new DatabaseSync("/home/z/my-project/db/custom.db")
const row = db.prepare("SELECT id FROM User LIMIT 1").get()
const b64url = (s) => Buffer.from(s).toString("base64url")
const SECRET = process.env.AUTH_SECRET || "leados-dev-secret-change-in-production"
const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
const body = b64url(JSON.stringify({ sub: row.id, exp: Math.floor(Date.now() / 1000) + 3600 }))
const sig = createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url")
const token = `${header}.${body}.${sig}`

const action = process.argv[2] || "status"
const extra = JSON.parse(process.argv[3] || "{}")

const r = await fetch("http://localhost:3000/api/agent/zizo", {
  method: action === "status" ? "GET" : "POST",
  headers: { "Content-Type": "application/json", Cookie: `leados_session=${token}` },
  ...(action === "status" ? {} : { body: JSON.stringify({ action, ...extra }) }),
  signal: AbortSignal.timeout(110000),
})
const j = await r.json().catch(() => ({}))
console.log("status:", r.status)
console.log(JSON.stringify(j, null, 1).slice(0, 2500))
