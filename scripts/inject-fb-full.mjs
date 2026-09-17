// inject-fb-full.mjs — حقن كوكيز فيسبوك بكل خصائصها من الـJSON (أدق مسار ممكن)
// يقرأ config/fb-session-cookies.json ويرسل الكوكيز كما هي للخدمة
import { readFileSync } from "node:fs"

const arr = JSON.parse(readFileSync("/home/z/my-project/config/fb-session-cookies.json", "utf8"))
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
