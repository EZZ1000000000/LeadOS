// Task 18b — إعادة اختبار لينكدإن بصيغ أبسط + بوستات جروبات فيسبوك + النيم المباشر
import { readFileSync, writeFileSync } from "fs"
const KEY = readFileSync("/tmp/serper_key", "utf8").trim()

const TESTS: Array<{ id: string; label: string; q: string }> = [
  { id: "LI-1", label: "لينكدإن بدون /in (عام)", q: '(site:linkedin.com) "مدير تسويق" القاهرة' },
  { id: "LI-2", label: "لينكدإن /in إنجليزي", q: '(site:linkedin.com/in) "marketing manager" Cairo' },
  { id: "LI-3", label: "لينكدإن اسم شخص بالظبط", q: '(site:linkedin.com/in) "Ahmed Hassan" Egypt' },
  { id: "FB-GROUP-POST", label: "فيسبوك بوست جروب محدد", q: '(site:facebook.com/groups) "محتاج مبرمج"' },
  { id: "FB-USERNAME", label: "فيسبوك نيم يوزر مباشر", q: '(site:facebook.com) "كافيه" صفحة' },
  { id: "IG-USERNAME", label: "انستجرام @نيم مباشر", q: '(site:instagram.com) "@" كافيه القاهرة' },
  { id: "X-USERNAME", label: "إكس from: نيم", q: '(site:x.com) كافيه القاهرة' },
  { id: "TIKTOK-ACC", label: "تيك توك أكاونت باسم", q: '(site:tiktok.com) "@كافيه" OR "كافيه" حساب' },
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
    const kinds = items.map(r => {
      const u = r.link!
      if (u.includes("/in/")) return "بروفايل شخصي"
      if (u.includes("/groups/")) return "جروب"
      if (u.includes("/posts/")) return "بوست"
      if (u.includes("/jobs/view") || u.includes("/jobs/search")) return "وظيفة"
      if (u.includes("/company/")) return "صفحة شركة"
      if (u.includes("/pages/") || /\/profile\.php/.test(u)) return "بروفايل فيسبوك"
      if (u.includes("/status/")) return "تغريدة"
      return "صفحة عامة"
    })
    const kindCount: Record<string, number> = {}
    for (const k of kinds) kindCount[k] = (kindCount[k] ?? 0) + 1
    out.push({ id: t.id, label: t.label, count: items.length, kinds: kindCount,
      sample: items.slice(0, 3).map(r => `${(r.link ?? "").replace("https://", "").slice(0, 55)} | ${(r.title ?? "").slice(0, 45)}`) })
    console.log(`\n=== ${t.id} — ${t.label} → ${items.length} | أنواع: ${JSON.stringify(kindCount)}`)
    for (const s of out.at(-1)!.sample as string[]) console.log("   ", s)
  } catch (e) {
    out.push({ id: t.id, label: t.label, count: 0, error: String(e).slice(0, 80) })
    console.log(`\n=== ${t.id} — خطأ: ${String(e).slice(0, 80)}`)
  }
  await new Promise(r => setTimeout(r, 700))
}

writeFileSync("/tmp/platform_name_test2.json", JSON.stringify(out, null, 1))
console.log("\n✅ x2")
