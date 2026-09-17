// test-fb-cookie-inject.mjs — يحقن كوكيز فيسبوك في المتصفح الستيلث (Camoufox)
// نفس منطق stealthInjectCookieHeader بالظبط: قراءة الهيدر من .env وتحويله لكوكيز
import { readFileSync } from "node:fs"

const env = readFileSync("/home/z/my-project/.env", "utf8")
const m = env.match(/^FACEBOOK_SESSION_COOKIE=(.*)$/m)
if (!m) { console.error("✗ مفيش FACEBOOK_SESSION_COOKIE في .env"); process.exit(1) }
const header = m[1].trim()

const cookies = header
  .split(/;\s*/)
  .map((pair) => {
    const eq = pair.indexOf("=")
    if (eq < 1) return null
    return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), domain: ".facebook.com", path: "/" }
  })
  .filter(Boolean)

const r = await fetch("http://127.0.0.1:9797/cookies", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ cookies }),
  signal: AbortSignal.timeout(30_000),
})
const j = await r.json().catch(() => ({}))
console.log(`POST /cookies → ${r.status}`, JSON.stringify(j))
if (j.ok && j.added >= cookies.length) {
  console.log(`✓ الحقن نجح: ${j.added}/${cookies.length} كوكي دخولوا بروفايل المتصفح (domain .facebook.com)`)
} else {
  console.log("✗ الحقن فشل أو جزئي")
}
