// test-fb-session-live.mjs — يتحقق إن جلسة فيسبوك حية: زبارة الهوم وجيب الحساب
// بيستخدم نفس بروفايل Camoufox اللي اتحقنت فيه الكوكيز
import { readFileSync } from "node:fs"

const env = readFileSync("/home/z/my-project/.env", "utf8")
const cUser = env.match(/^FACEBOOK_SESSION_COOKIE=.*\n/m) ? (readFileSync("/home/z/my-project/config/fb-session-cookies.json", "utf8").match(/"name": "c_user"[\s\S]*?"value": "(\d+)"/) || [])[1] : null

const nav = await fetch("http://127.0.0.1:9797/navigate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: "https://www.facebook.com/", wait_until: "domcontentloaded", timeout: 60_000, scroll_times: 1 }),
  signal: AbortSignal.timeout(150_000),
})
const j = await nav.json().catch(() => ({}))
const url = j.url ?? ""
const text = (j.text ?? "").slice(0, 1500)

const loginWall = /login|checkpoint/i.test(url) || /تسجيل الدخول|log in or sign up|Log in to Facebook/i.test(text)
const loggedIn = !loginWall && (text.includes("إليك") || text.includes("الأحداث") || /home|feed/i.test(url) || text.includes("الصفحة الرئيسية") || new RegExp(cUser ?? "€").test(text))

console.log(`URL النهائي: ${url}`)
console.log(`حالة: ${loginWall ? "✗ جدار دخول — الجلسة مش شغالة" : loggedIn ? "✓ مسجل دخول — الجلسة حية" : "؟ مش واضح"}`)
console.log("--- أول 600 حرف من الصفحة ---")
console.log(text.slice(0, 600))
