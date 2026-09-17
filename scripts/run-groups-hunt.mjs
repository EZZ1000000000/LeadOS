// run-groups-hunt.mjs — تشغيل مصدر الجروبات كاملًا (المصدر 13): اكتشاف → مراقبة → مسح حي عبر جلسة فيسبوك
import { createHmac } from "node:crypto"
import { DatabaseSync } from "node:sqlite"

const db = new DatabaseSync("/home/z/my-project/db/custom.db")
const row = db.prepare("SELECT id FROM User LIMIT 1").get()
const b64url = (s) => Buffer.from(s).toString("base64url")
const SECRET = process.env.AUTH_SECRET || "leados-dev-secret-change-in-production"
const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
const body = b64url(JSON.stringify({ sub: row.id, exp: Math.floor(Date.now() / 1000) + 7200 }))
const sig = createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url")
const token = `${header}.${body}.${sig}`
const H = { "Content-Type": "application/json", Cookie: `leados_session=${token}` }

const api = async (path, payload, timeoutMs = 280000) => {
  const r = await fetch("http://localhost:3000" + path, {
    method: payload === undefined ? "GET" : "POST",
    headers: H,
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const j = await r.json().catch(() => ({}))
  return { status: r.status, j }
}

// 1) حالة الجلسة
const meta = await api("/api/groups", undefined)
console.log("[meta]", JSON.stringify(meta.j).slice(0, 200))

// 2) اكتشاف جروبات حية بكلمات نية الشراء
const kws = process.argv[2]
  ? process.argv[2].split(",")
  : ["عقارات مصر", "فرص عمل", "مطاعم وكافيهات", "تجار وموزعين"]
console.log("\n[اكتشاف جروبات] كلمات:", kws.join("، "))
const disc = await api("/api/groups/discover", { platform: "FACEBOOK", keywords: kws, segment: "AGENCY" }, 240000)
console.log("status:", disc.status)
console.log(JSON.stringify(disc.j, null, 1).slice(0, 1200))

// 3) مسح الجروبات المستحقة (حتى 4) عبر الجلسة الحية
console.log("\n[مسح الجروبات] ...")
const scan = await api("/api/groups/scan", {}, 280000)
console.log("status:", scan.status)
console.log(JSON.stringify(scan.j, null, 1).slice(0, 1500))
