// تشخيص توزيع درجات الصلة في عينة عشوائية — من غير عتبة
const HF_ROWS_URL = "https://datasets-server.huggingface.co/rows?dataset=mvaccargiu%2Fgitskills&config=artifacts&split=train"
const TERMS = [
  [/lead[\s-]?generat|prospect(ing|us)?\b|client acquisition|customer acquisition/i, 30],
  [/\boutreach\b|\bcold[\s-]?(email|message|dm|calling)\b|\bprospecting\b/i, 28],
  [/\bsales\b|\bselling\b|\bup sell(ing)?\b|\bsales ?pipeline/i, 22],
  [/\bmarketing\b|growth[\s-]?hack|\bpromotion(al)?\b|\badvertis(e|ing|ements?)\b/i, 18],
  [/\bseo\b|search engine optim|\bbacklink(s)?\b|keyword research/i, 16],
  [/social[\s-]?media|\bsmm\b|\bengagement rate\b|\binfluencer(s)?\b/i, 14],
]
async function batch(off) {
  const res = await fetch(`${HF_ROWS_URL}&offset=${off}&length=100`)
  const d = await res.json()
  return (d.rows ?? []).map((r) => {
    const row = r.row
    const c = String(row.content ?? "")
    if (c.length < 80) return -1
    return TERMS.reduce((acc, [re, pts]) => acc + (re.test(c) ? pts : 0), 0)
  })
}
const all = []
for (let i = 0; i < 5; i++) all.push(...await batch(Math.floor(Math.random() * 3797000)))
const valid = all.filter((s) => s >= 0)
console.log(`صفوف فيها محتوى: ${valid.length}/${all.length}`)
const hist = [0, 0, 0, 0, 0, 0] // 0, 1-15, 16-23, 24-39, 40-59, 60+
for (const s of valid) {
  if (s === 0) hist[0]++
  else if (s < 16) hist[1]++
  else if (s < 24) hist[2]++
  else if (s < 40) hist[3]++
  else if (s < 60) hist[4]++
  else hist[5]++
}
console.log("درجة 0:", hist[0], "| 1-15:", hist[1], "| 16-23:", hist[2], "| 24-39:", hist[3], "| 40-59:", hist[4], "| 60+:", hist[5])
