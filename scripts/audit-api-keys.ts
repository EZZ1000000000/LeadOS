// جرد حي: اختبار كل مفتاح API في النظام + تقدير الحصة المتبقية
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync("/home/z/my-project/.env", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
)

async function j(url: string, opts: RequestInit = {}) {
  try {
    const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(15000) })
    return { status: r.status, body: await r.text() }
  } catch (e) { return { status: 0, body: String(e) } }
}

const results: Array<{ name: string; ok: boolean; note: string; freeTier: string }> = []

// 1) Serper — البحث الأساسي
{
  const r = await j("https://google.serper.dev/search", { method: "POST", headers: { "X-API-KEY": env.SERPER_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ q: "test", num: 1 }) })
  const credits = r.headers; void credits
  results.push({ name: "Serper (بحث جوجل + خرائط)", ok: r.status === 200, note: `HTTP ${r.status}`, freeTier: "2500 كريدت مرة واحدة (مش شهري)" })
}
// 2) Tavily
{
  const r = await j("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: env.TAVILY_API_KEY, query: "test", max_results: 1 }) })
  results.push({ name: "Tavily (بحث عميق)", ok: r.status === 200, note: `HTTP ${r.status}`, freeTier: "1000 كريدت/شهر (متكرر مجاني)" })
}
// 3) SerpAPI
{
  const r = await j(`https://serpapi.com/account?api_key=${env.SERPAPI_API_KEY}`)
  let note = `HTTP ${r.status}`
  try { const a = JSON.parse(r.body); note = `باقي ${a.total_searches_left ?? "?"} بحث هذا الشهر` } catch {}
  results.push({ name: "SerpAPI", ok: r.status === 200, note, freeTier: "100 بحث/شهر (متكرر مجاني)" })
}
// 4) Exa
{
  const r = await j("https://api.exa.ai/search", { method: "POST", headers: { "x-api-key": env.EXA_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ query: "test", numResults: 1 }) })
  results.push({ name: "Exa (بحث نيو مورفزم)", ok: r.status === 200, note: `HTTP ${r.status}`, freeTier: "$10 كريدت مرة واحدة" })
}
// 5) Mistral — أول مفتاح
{
  const first = env.MISTRAL_API_KEYS?.split(",")[0]?.trim() ?? env.MISTRAL_API_KEY
  const r = await j("https://api.mistral.ai/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${first}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "mistral-small-latest", messages: [{ role: "user", content: "hi" }], max_tokens: 5 }) })
  const ok = r.status === 200
  results.push({ name: `Mistral (الشات/التصنيف) — مفتاح 1 من 25`, ok, note: ok ? "شغال" : `HTTP ${r.status} ${r.status === 429 ? "— حصة الشهر خلصت" : r.body.slice(0, 60)}`, freeTier: "مجاني بحصص صغيرة/مفتاح — بيخلص بسرعة" })
}
// 6) GitHub
{
  const gh = readFileSync("/home/z/my-project/upload/api من جيت هاب.txt", "utf8").trim()
  const r = await j("https://api.github.com/rate_limit", { headers: { Authorization: `Bearer ${gh}` } })
  let note = `HTTP ${r.status}`
  try { const a = JSON.parse(r.body); note = `core: ${a.resources?.core?.remaining}/${a.resources?.core?.limit}` } catch {}
  results.push({ name: "GitHub (الكود + Actions)", ok: r.status === 200, note, freeTier: "Actions: 2000 دقيقة/شهر (خاص) — كافية للتيك كل 10 دقايق" })
}

console.log("═".repeat(70))
console.log("🔑 جرد المفاتيح الحية")
console.log("═".repeat(70))
for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.name}\n   ${r.note}\n   المجاني: ${r.freeTier}`)
process.exit(0)
