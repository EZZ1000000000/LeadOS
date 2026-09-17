// test-fb-confirm-invalid.mjs — تأكيد نهائي: حقن كامل ثم دخول عميق على /feed
import { readFileSync } from "node:fs"

const post = async (endpoint, body, timeout = 150_000) => {
  const r = await fetch(`http://127.0.0.1:9797${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  })
  return r.json().catch(() => ({}))
}

// حقن كامل بالخصائص
const arr = JSON.parse(readFileSync("/home/z/my-project/config/fb-session-cookies.json", "utf8"))
const full = arr.map((c) => {
  const out = {
    name: c.name, value: c.value,
    domain: c.domain || ".facebook.com", path: c.path || "/",
    secure: c.secure ?? true, httpOnly: c.httpOnly ?? false,
    sameSite: c.sameSite === "no_restriction" ? "None" : c.sameSite === "lax" ? "Lax" : "Strict",
  }
  if (!c.session && c.expirationDate) out.expires = Math.floor(c.expirationDate)
  return out
})
const inj = await post("/cookies", { cookies: full })
console.log("حقن:", JSON.stringify(inj))

// دخول مباشر على صفحة محمية
const nav = await post("/navigate", { url: "https://www.facebook.com/feed/", wait_until: "domcontentloaded", timeout: 60_000 })
const text = (nav.text ?? "").slice(0, 300)
console.log("URL النهائي:", nav.url)
console.log("الصفحة:", text.replace(/\n+/g, " | ").slice(0, 250))

// الجرة بعد المحاولة
const jar = await post("/act", {
  session: "default",
  action: "eval",
  script: "JSON.stringify(document.cookie.split(';').map(c => c.trim().split('=')[0]))",
})
console.log("الجرة بعد المحاولة:", jar.result)
