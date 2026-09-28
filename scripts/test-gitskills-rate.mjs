// قياس معدل النجاح الحقيقي على 15 دفعة متوازية
const URL = "https://datasets-server.huggingface.co/rows?dataset=mvaccargiu%2Fgitskills&config=artifacts&split=train"
const TERMS = [
  [/lead[\s-]?generat|prospect(ing|us)?\b|client acquisition|customer acquisition/i, 30],
  [/\boutreach\b|\bcold[\s-]?(email|message|dm|calling)\b|\bprospecting\b/i, 28],
  [/\bsales\b|\bselling\b|\bup sell(ing)?\b|\bsales ?pipeline/i, 22],
  [/\bmarketing\b|growth[\s-]?hack|\bpromotion(al)?\b|\badvertis(e|ing|ements?)\b/i, 18],
  [/\bseo\b|search engine optim|\bbacklink(s)?\b|keyword research/i, 16],
  [/social[\s-]?media|\bsmm\b|\bengagement rate\b|\binfluencer(s)?\b/i, 14],
  [/\bcrm\b|customer relationship/i, 12],
  [/\breddit\b|\blinkedin\b|\binstagram\b|\bfacebook\b|\btiktok\b|\byoutube\b|\btelegram\b|\bdiscord\b|\bquora\b/i, 12],
]
async function one() {
  const off = Math.floor(Math.random() * 3797000)
  const t0 = Date.now()
  try {
    const res = await fetch(`${URL}&offset=${off}&length=100`, { headers: { "User-Agent": "LeadOS/1.0" } })
    if (!res.ok) return { rows: [], ms: Date.now() - t0 }
    const d = await res.json()
    return { rows: (d.rows ?? []).map((r) => r.row), ms: Date.now() - t0 }
  } catch { return { rows: [], ms: Date.now() - t0 } }
}
const t0 = Date.now()
const results = await Promise.all(Array.from({ length: 15 }, one))
let withContent = 0, passed = 0, contentRows = 0
for (const { rows } of results) {
  for (const row of rows) {
    const c = String(row.content ?? "")
    if (c.length < 80) continue
    contentRows++
    const score = TERMS.reduce((a, [re, p]) => a + (re.test(c) ? p : 0), 0)
    if (score >= 24) { passed++; console.log(`PASS ${score} | ${row.repo_full_name} | ${String(row.path).slice(0, 60)}`) }
  }
}
const ms = Date.now() - t0
console.log(`\n${contentRows} صف بمحتوى من 1500 → ${passed} ناجح (${((passed / Math.max(1, contentRows)) * 100).toFixed(1)}%) — زمن موازي: ${ms}ms`)
