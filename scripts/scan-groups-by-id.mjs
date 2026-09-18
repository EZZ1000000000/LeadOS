// scan-groups-by-id.mjs — مسح جروبات محددة بالإجبار (بغض النظر عن الجدولة)
import { createHmac } from "node:crypto"
import { DatabaseSync } from "node:sqlite"
const db = new DatabaseSync("/home/z/my-project/db/custom.db")
const row = db.prepare("SELECT id FROM User LIMIT 1").get()
const b64url = (s) => Buffer.from(s).toString("base64url")
const S = process.env.AUTH_SECRET || "leados-dev-secret-change-in-production"
const h = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
const p = b64url(JSON.stringify({ sub: row.id, exp: Math.floor(Date.now() / 1000) + 7200 }))
const sig = createHmac("sha256", S).update(`${h}.${p}`).digest("base64url")
const token = `${h}.${p}.${sig}`
const ids = process.argv.slice(2)
for (const id of ids) {
  const r = await fetch("http://localhost:3000/api/groups/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `leados_session=${token}` },
    body: JSON.stringify({ groupId: id }),
    signal: AbortSignal.timeout(280000),
  })
  const j = await r.json().catch(() => ({}))
  const res = j?.results?.[0]
  console.log(`${id.slice(-6)}: status=${res?.status} newPosts=${res?.newPosts} note=${(res?.note ?? "").slice(0, 90)}`)
}
