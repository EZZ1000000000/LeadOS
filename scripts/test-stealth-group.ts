// اختبار الرادار الحي: حقن كوكيزك في كاموفوكس → فتح جروب → هل البوستات تظهر؟
import { db } from "../src/lib/db"
import { stealthInjectCookieHeader, stealthNavigate, stealthExtract, ensureStealth, stealthHealth } from "../src/lib/agent/stealth-browser"

const cookie = process.env.FACEBOOK_SESSION_COOKIE
if (!cookie) { console.log("❌ مفيش كوكي"); process.exit(1) }

console.log("health:", JSON.stringify(await stealthHealth()))
const ok = await ensureStealth(120_000)
console.log("stealth ready:", ok)
if (!ok) process.exit(1)

const injected = await stealthInjectCookieHeader(cookie)
console.log("cookies injected:", injected)

const group = await db.monitoredGroup.findFirst({ where: { platform: "FACEBOOK" } })
if (!group) { console.log("❌ مفيش جروب"); process.exit(1) }
console.log("group:", group.name.slice(0, 50), group.url)

const nav = await stealthNavigate({
  url: group.url,
  wait_until: "domcontentloaded",
  timeout: 90_000,
  scroll_times: 3,
  session: "fb",
})
console.log("nav ok:", nav.ok, "| final url:", (nav.url ?? "").slice(0, 70), "| text len:", (nav.text ?? "").length)
const text = nav.text ?? ""
console.log("login wall:", /تسجيل الدخول|log in to facebook|checkpoint/i.test(text))
console.log("posts visible:", /\bمحتاج\b|\bعايز\b|\bمطلوب\b|وظيفة|خبرة|CV/i.test(text))
console.log("— أول 600 حرف —")
console.log(text.slice(0, 600))
// تجربة استخراج مقالات
const ex = await stealthExtract({ selector: 'div[role="article"]', limit: 10, session: "fb" })
console.log("extract ok:", ex.ok, "count:", ex.count, "| first:", (ex.items?.[0] ?? "").slice(0, 150).replace(/\n/g, " "))
process.exit(0)
