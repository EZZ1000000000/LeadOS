// تشخيص حي: جلب صفحة جروب فيسبوك بالكوكي المحلي وفحص بصمات الـJSON الحالية
import * as fs from "node:fs"

const cookie = process.env.FACEBOOK_SESSION_COOKIE
if (!cookie) throw new Error("مفيش كوكي في .env.local")

const GROUP = process.argv[2] || "اصحابكافيهاتومطاعممصر"
const res = await fetch(`https://www.facebook.com/groups/${GROUP}/posts/`, {
  headers: {
    Cookie: cookie,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept-Language": "ar,eg;q=0.9,en;q=0.8",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Sec-Fetch-Mode": "navigate",
  },
  signal: AbortSignal.timeout(25000),
  redirect: "follow",
})
const html = await res.text()
fs.writeFileSync("/tmp/fb-group.html", html)
console.log("HTTP:", res.status, "| الحجم:", (html.length / 1024).toFixed(0), "KB")

// بصمات قديمة وجديدة محتملة
const sigs: Array<[string, RegExp]> = [
  ["Story typename (قديم)", /"__typename":"Story"/g],
  ["post_id (قديم)", /"post_id":/g],
  ["message.text (قديم)", /"message":\{"text":/g],
  ["creation_time (قديم)", /"creation_time":\d{9,11}/g],
  ["feed_unit_story", /feed_unit_story/gi],
  ["\"text\":\"\"\" / محتوى عربي حقيقي", /"text":"[^"]{40,200}محتاج[^"]{0,80}"/g],
  ["feedback targets", /"feedback_target"/g],
  ["subscription_target_id", /subscription_target_id/g],
  ["story عام", /"story":\{/g],
  ["UFI2/Relay modern", /"__isFeedUnit"/g],
  ["أي نص عربي طويل في JSON", /\\u0645\\u062d\\u062a\\u0627\\u062c/g],
]
for (const [name, re] of sigs) {
  const n = (html.match(re) || []).length
  console.log(`${n ? "✅" : "—"} ${name}: ${n}`)
}
console.log("\nlogin_wall؟", /login_form|checkpoint/i.test(html))
console.log("محتوى غير متاح؟", /محتوى غير متوفر|content isn't available/i.test(html))
