import { rawWebSearch } from "@/lib/discovery"
for (const q of ["سيرفر ديسكورد ريادة اعمال مصر", "معرض مطاعم وكافيهات مصر 2026", "مكتبة اعلانات فيسبوك مصر"]) {
  const { results, provider } = await rawWebSearch(q, 8)
  console.log(`\n[Q] ${q} → provider=${provider} n=${results.length}`)
  for (const r of results.slice(0, 5)) console.log(`  • ${r.url.slice(0, 100)} | ${(r.title ?? "").slice(0, 50)}`)
}
