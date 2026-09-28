// تشخيص: نفس منطق الوحدة خطوة بخطوة
const TOTAL = 3_797_117
const URL = "https://datasets-server.huggingface.co/rows?dataset=mvaccargiu%2Fgitskills&config=artifacts&split=train"
const offset = Math.floor(Math.random() * (TOTAL - 100))
const res = await fetch(`${URL}&offset=${offset}&length=100`)
console.log("HTTP", res.status)
const data = await res.json()
const rows = data.rows ?? []
console.log("rows:", rows.length)
let withContent = 0, parsed = 0, passed = 0
const MIN = 24
const TERMS: Array<[RegExp, number]> = [
  [/lead[\s-]?generat|prospect(ing|us)?\b|client acquisition|customer acquisition/i, 30],
  [/\boutreach\b|\bcold[\s-]?(email|message|dm|calling)\b|\bprospecting\b/i, 28],
  [/\bsales\b|\bselling\b|\bup sell(ing)?\b|\bsales ?pipeline/i, 22],
  [/\bmarketing\b|growth[\s-]?hack|\bpromotion(al)?\b|\badvertis(e|ing|ements?)\b/i, 18],
  [/\bseo\b|search engine optim|\bbacklink(s)?\b|keyword research/i, 16],
]
for (const r of rows) {
  const row = r.row
  const content = String(row?.content ?? "")
  if (content.length < 80) continue
  withContent++
  const score = TERMS.reduce((a, [re, p]) => a + (re.test(content) ? p : 0), 0)
  if (score >= MIN) { passed++; console.log(`PASS score=${score} repo=${row.repo_full_name} path=${String(row.path).slice(0,50)}`) }
}
console.log({ withContent, passed, offset })
