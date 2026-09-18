// diag-fb-group-html.mjs — تشخيص بنية صفحة الجروب الحالية (إيه اللي في الـHTML فعلاً؟)
import { readFileSync, writeFileSync } from "node:fs"

const env = readFileSync("/home/z/my-project/.env", "utf8")
const cookie = env.match(/^FACEBOOK_SESSION_COOKIE=(.+)$/m)?.[1]?.trim()
if (!cookie) { console.error("no cookie"); process.exit(1) }

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0"
const res = await fetch("https://www.facebook.com/groups/5407998809247284/posts/", {
  headers: { Cookie: cookie, "User-Agent": UA, "Accept-Language": "ar,eg;q=0.9,en;q=0.8", Accept: "text/html" },
  signal: AbortSignal.timeout(25000),
  redirect: "follow",
})
const html = await res.text()
console.log("HTTP:", res.status, "| len:", html.length)

const probes = {
  story_tn: /"__typename":"Story"/g,
  post_id: /"post_id":"/g,
  msg_text: /"message":\{"text":"/g,
  creation_time: /"creation_time":/g,
  feedunit: /"__typename":"FeedUnit/g,
  cluster: /"__typename":"Cluster"/g,
  groupStory: /"__typename":"GroupStory"/g,
  note: /"__typename":"Note"/g,
  bbcode: /"__isCommunityNote"/g,
  attached_story: /"attached_story"/g,
  text_present: /"text":\{"text":/g,
  createstory: /"create_story"/g,
  storyList: /"stories":/g,
  serverdot: /"__typename":"Page"/g,
  bodyText: /"body":\{"text":"/g,
  feedback: /"feedback":\{"id":"/g,
  MF_ml: /"message":/g,
}
for (const [k, re] of Object.entries(probes)) {
  const n = (html.match(re) || []).length
  console.log(`${k}: ${n}`)
}

// أول 3 أماكن فيها "__typename" بشكل عام — نشوف الأنواع الموجودة
const types = {}
for (const m of html.matchAll(/"__typename":"(\w+)"/g)) types[m[1]] = (types[m[1]] || 0) + 1
console.log("\nTOP __typename:", JSON.stringify(Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 18)))

writeFileSync("/home/z/my-project/scripts/tmp-group-page.html", html.slice(0, 3_000_000))
console.log("\nsaved: scripts/tmp-group-page.html")
