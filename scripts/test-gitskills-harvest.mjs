// اختبار حصاد GitSkills — نفس منطق src/lib/skills/gitskills.ts بالظبط
const HF_ROWS_URL = "https://datasets-server.huggingface.co/rows?dataset=mvaccargiu%2Fgitskills&config=artifacts&split=train"
const TOTAL_ROWS = 3797117

const RELEVANCE_TERMS = [
  [/lead[\s-]?generat|prospect(ing|us)?\b|client acquisition|customer acquisition/i, 30, "lead-gen"],
  [/\boutreach\b|\bcold[\s-]?(email|message|dm|calling)\b|\bprospecting\b/i, 28, "outreach"],
  [/\bsales\b|\bselling\b|\bup sell(ing)?\b|\bsales ?pipeline/i, 22, "sales"],
  [/\bmarketing\b|growth[\s-]?hack|\bpromotion(al)?\b|\badvertis(e|ing|ements?)\b/i, 18, "marketing"],
  [/\bseo\b|search engine optim|\bbacklink(s)?\b|keyword research/i, 16, "seo"],
  [/social[\s-]?media|\bsmm\b|\bengagement rate\b|\binfluencer(s)?\b/i, 14, "social"],
  [/content (marketing|strategy|creation)|\bcopywriting\b/i, 12, "content"],
  [/\bcrm\b|customer relationship|\bcontact management\b/i, 12, "crm"],
  [/\breddit\b|\blinkedin\b|\binstagram\b|\bfacebook\b|\btiktok\b|\byoutube\b|\btelegram\b|\bdiscord\b|\bquora\b/i, 12, "platform"],
  [/small business(es)?|local business(es)?|\brestaurant(s)?\b|\bclinic(s)?\b|\bsalon(s)?\b|\bretail(ers?)?\b/i, 10, "local-biz"],
  [/\bfunnel(s)?\b|landing page(s)?|\bnewsletter(s)?\b|mailing list(s)?/i, 10, "funnel"],
  [/\bfreelanc(e|er|ing|ers)\b|\bgig economy\b/i, 8, "freelance"],
  [/market research|competitor analysis|niche research/i, 8, "research"],
]
const MIN_RELEVANCE = 26

function parseFrontmatter(raw) {
  const fm = {}
  let body = raw
  if (raw.startsWith("---")) {
    const end = raw.indexOf("\n---", 3)
    if (end > 0) {
      const head = raw.slice(3, end)
      body = raw.slice(end + 4).trim()
      for (const line of head.split("\n")) {
        const m = line.match(/^(\w[\w-]*):\s*(.+)$/)
        if (m) fm[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
      }
    }
  }
  return { fm, body }
}

function scoreSkill(name, description, body) {
  const hay = `${name} ${description} ${body.slice(0, 1200)}`
  let relevance = 0
  const tags = []
  for (const [re, pts, tag] of RELEVANCE_TERMS) {
    if (re.test(hay)) { relevance += pts; if (!tags.includes(tag)) tags.push(tag) }
  }
  return { relevance, tags }
}

function firstMeaningfulLine(body) {
  for (const line of body.split("\n").slice(0, 12)) {
    const clean = line.replace(/^[#>*|\-\s]+/, "").replace(/[|`]/g, " ").replace(/\s+/g, " ").trim()
    if (clean.length >= 25 && !/^\d+$/.test(clean)) return clean
  }
  return ""
}

function toHarvested(row) {
  const repo = String(row.repo_full_name ?? "").trim()
  const path = String(row.path ?? "").trim()
  const content = String(row.content ?? "")
  if (!repo || !path || content.length < 80) return null
  const { fm, body } = parseFrontmatter(content)
  const name = String(fm.name || row.name || "").trim() || String(path.split("/").slice(-2, -1)[0] || "")
  const description = String(fm.description || row.description || "").trim() || firstMeaningfulLine(body)
  if (!name || name.length < 3) return null
  if (description.length < 20 && body.length < 200) return null
  const { relevance, tags } = scoreSkill(name, description, body)
  if (relevance < MIN_RELEVANCE) return null
  return { repo, path, name: name.slice(0, 120), description: description.slice(0, 400), relevance, tags: tags.slice(0, 6) }
}

async function fetchRandomBatch(length = 100) {
  const offset = Math.floor(Math.random() * (TOTAL_ROWS - length))
  const t0 = Date.now()
  const res = await fetch(`${HF_ROWS_URL}&offset=${offset}&length=${length}`, { headers: { "User-Agent": "LeadOS-GitSkills-Harvester/1.0" } })
  if (!res.ok) { console.log(`  offset=${offset} → HTTP ${res.status}`); return [] }
  const data = await res.json()
  const rows = data.rows ?? []
  const out = rows.map((r) => toHarvested(r.row)).filter(Boolean)
  console.log(`  offset=${offset} → ${rows.length} صف، ${out.length} مهارة صلة (${Date.now() - t0}ms)`)
  return out
}

async function main() {
  const collected = []
  for (let i = 0; i < 3; i++) collected.push(...await fetchRandomBatch(100))
  console.log(`\nالمجموع: ${collected.length} مهارة مرشحة من 300 صف`)
  const top = collected.sort((a, b) => b.relevance - a.relevance).slice(0, 8)
  for (const s of top) {
    console.log(`\n⭐ ${s.relevance} | ${s.name} [${s.tags.join(",")}]`)
    console.log(`   repo: ${s.repo}`)
    console.log(`   ${s.description.slice(0, 140)}`)
  }
}
main().catch((e) => { console.error("FAIL:", e.message); process.exit(1) })
