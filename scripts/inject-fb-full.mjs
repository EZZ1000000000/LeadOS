// inject-fb-full.mjs — حقن كوكيز بكل خصائصها من الـJSON (أدق مسار ممكن)
// الاستخدام: node scripts/inject-fb-full.mjs [مسار-json]  — الافتراضي فيسبوك، ويدعم واتساب ويب (المجال بيتقرا من الـJSON)
import { readFileSync } from "node:fs"

const jsonPath = process.argv[2] || "/home/z/my-project/config/fb-session-cookies.json"
const arr = JSON.parse(readFileSync(jsonPath, "utf8"))
const cookies = arr.map((c) => {
  const out = {
    name: c.name,
    value: c.value,
    domain: c.domain || ".facebook.com",
    path: c.path || "/",
    secure: c.secure ?? true,
    httpOnly: c.httpOnly ?? false,
    sameSite: c.sameSite === "no_restriction" ? "None" : c.sameSite === "lax" ? "Lax" : c.sameSite === "strict" ? "Strict" : "Lax",
  }
  if (!c.session && c.expirationDate) out.expires = Math.floor(c.expirationDate)
  return out
})

const r = await fetch("http://127.0.0.1:9797/cookies", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ cookies }),
  signal: AbortSignal.timeout(60_000),
})
const j = await r.json().catch(() => ({}))
console.log(`حقن كامل الخصائص: ${JSON.stringify(j)} (من ${arr.length} كوكي في الـJSON)`)
