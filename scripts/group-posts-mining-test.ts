// Task 19 — هل بوستات الجروبات المفهرسة موجودة؟ صيغ متعددة + جروبات مصرية معروفة
import { readFileSync, writeFileSync } from "fs"
const KEY = readFileSync("/tmp/serper_key", "utf8").trim()

const TESTS: Array<{ id: string; q: string }> = [
  { id: "G1", q: '(site:facebook.com/groups) "محتاج" (مبرمج OR تسويق OR مصور) مصر' },
  { id: "G2", q: 'site:facebook.com/groups "عايز" "متجر إلكتروني"' },
  { id: "G3", q: 'site:facebook.com/groups/posts "محتاج"' },
  { id: "G4", q: '(site:facebook.com) (/groups/*/posts/) "محتاج"' },
  { id: "G5", q: 'facebook.com/groups "محتاج موقع لشركتي"' },
  { id: "G6", q: 'site:facebook.com/groups "مطلوب" "حملة إعلانية"' },
  { id: "G7", q: 'site:m.facebook.com/groups "محتاج" تسويق' },
  { id: "G8", q: 'site:facebook.com/groups "كافيه" "محتاج" OR "عايز"' },
  { id: "G9", q: 'site:facebook.com/groups "نظام كروت" OR "كروت واي فاي"' },
  { id: "G10", q: 'site:facebook.com/groups "شكرا" "التطبيق اللي عملتوه" مطعم' },
]

interface Organic { title?: string; link?: string }
const out: Array<Record<string, unknown>> = []

for (const t of TESTS) {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ q: t.q, num: 10, gl: "eg", hl: "ar" }),
      signal: AbortSignal.timeout(15000),
    })
    const data = (await res.json()) as { organic?: Organic[] }
    const items = (data.organic ?? []).filter(r => r.link)
    const posts = items.filter(r => /\/posts\//.test(r.link!)).length
    out.push({ id: t.id, total: items.length, groupPostUrls: posts,
      sample: items.slice(0, 3).map(r => `${r.link!.replace("https://", "").slice(0, 60)} | ${(r.title ?? "").slice(0, 40)}`) })
    console.log(`${t.id} → ${items.length} نتيجة (منها ${posts} رابط بوست جروب مباشر)`)
    for (const s of out.at(-1)!.sample as string[]) console.log("   ", s)
  } catch (e) { out.push({ id: t.id, error: String(e).slice(0, 60) }); console.log(`${t.id} → خطأ`) }
  await new Promise(r => setTimeout(r, 700))
}
writeFileSync("/tmp/group_mining_test.json", JSON.stringify(out, null, 1))
console.log("\n✅")
