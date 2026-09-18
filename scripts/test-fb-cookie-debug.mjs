// test-fb-cookie-debug.mjs — تشخيص ليه الكوكيز مش بتظهر في الصفحة
// اختبار A: كوكي تجريبي بدون خصائص | اختبار B: كوكيز فيسبوك بكل الخصائص من الـJSON
import { readFileSync } from "node:fs"

const post = async (endpoint, body, timeout = 120_000) => {
  const r = await fetch(`http://127.0.0.1:9797${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  })
  return r.json().catch(() => ({}))
}
const evalJs = async (script) => {
  const r = await post("/act", { session: "default", action: "eval", script })
  return r.result ?? JSON.stringify(r).slice(0, 300)
}

// ── اختبار A: كوكي تجريبي بسيط زي ما الخدمة بتعمل ──
await post("/cookies", { cookies: [{ name: "zizo_test_a", value: "hello", domain: ".facebook.com", path: "/" }] })
const page = await post("/navigate", { url: "https://www.facebook.com/", wait_until: "domcontentloaded", timeout: 60_000 })
const a = await evalJs("document.cookie")
console.log("A) بعد كوكي تجريبي بسيط:", a.slice(0, 200))

// ── اختبار B: نفس الكوكيز لكن بكل الخصائص (secure/sameSite/expires) ──
const arr = JSON.parse(readFileSync("/home/z/my-project/config/fb-session-cookies.json", "utf8"))
const full = arr.map((c) => {
  const out = {
    name: c.name,
    value: c.value,
    domain: c.domain || ".facebook.com",
    path: c.path || "/",
    secure: c.secure ?? true,
    httpOnly: c.httpOnly ?? false,
    sameSite: c.sameSite === "no_restriction" ? "None" : c.sameSite === "lax" ? "Lax" : "Strict",
  }
  if (!c.session && c.expirationDate) out.expires = Math.floor(c.expirationDate)
  return out
})
const b = await post("/cookies", { cookies: full })
console.log("B) حقن كامل:", JSON.stringify(b))
const c = await evalJs("document.cookie")
console.log("B) بعد الحقن الكامل:", c.slice(0, 300))
