// Task 18 — اختبار حي: حدود البحث بالأسماء/النيمات على كل منصة
// بيجرّب site: لكل منصة عبر Serper (نفس محرك LeadOS) ويرجّع عدد النتائج + عينات
import { readFileSync, writeFileSync } from "fs"

// قراءة المفتاح من ملف مؤقت (كتبناه من فك تشفير Vercel)
const KEY = readFileSync("/tmp/serper_key", "utf8").trim()
if (!KEY) throw new Error("no serper key")

const TESTS: Array<{ platform: string; label: string; q: string }> = [
  // منصة: فيسبوك — أسماء صفحات/بروفايلات
  { platform: "FACEBOOK", label: "صفحات كافيهات (بيزنس)", q: "(site:facebook.com) كافيه القاهرة" },
  { platform: "FACEBOOK-PROF", label: "نيم/بروفايل شخص", q: '(site:facebook.com) "محمد أحمد" بروفيل' },
  { platform: "FACEBOOK-GROUP", label: "جروبات (بوستات طلب خدمات)", q: '(site:facebook.com) "محتاج مبرمج" جروب' },
  // انستجرام — نيمات
  { platform: "INSTAGRAM", label: "أكاونتات بالاسم", q: '(site:instagram.com) كافيه القاهرة' },
  // لينكدإن — بروفايلات بأسماء حقيقية
  { platform: "LINKEDIN", label: "بروفايلات موظفين", q: '(site:linkedin.com/in) مدير تسويق القاهرة' },
  { platform: "LINKEDIN-JOB", label: "وظائف (شركة بتدور موظف)", q: '(site:linkedin.com/jobs) مسؤول تسويق القاهرة' },
  // X
  { platform: "X", label: "أكاونتات/تغريدات", q: '(site:x.com OR site:twitter.com) محتاج مطور تطبيق' },
  // ريدت — مفتوح بالكامل
  { platform: "REDDIT", label: "بوستات طلب خدمات", q: '(site:reddit.com) Egypt looking for developer' },
  // تيك توك + يوتيوب
  { platform: "TIKTOK", label: "أكاونتات/فيديوهات", q: '(site:tiktok.com) كافيه القاهرة' },
  { platform: "YOUTUBE", label: "قنوات/فيديوهات", q: '(site:youtube.com) مراجعة كافيه القاهرة' },
  // دليل: بحث باسم بيزنس مباشرة
  { platform: "DIRECTORY", label: "دلائل أعمال مصرية", q: '(site:yellowpages.com.eg) كافيه' },
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
    const sample = items.slice(0, 3).map(r => {
      let host = ""
      try { host = new URL(r.link!).hostname.replace(/^www\./, "") } catch { /* ignore */ }
      return `${host} | ${(r.title ?? "").slice(0, 60)}`
    })
    out.push({ platform: t.platform, label: t.label, count: items.length, sample })
    console.log(`\n=== ${t.platform} — ${t.label} → ${items.length} نتيجة`)
    for (const s of sample) console.log("   ", s)
  } catch (e) {
    out.push({ platform: t.platform, label: t.label, count: 0, error: String(e).slice(0, 80) })
    console.log(`\n=== ${t.platform} — خطأ: ${String(e).slice(0, 80)}`)
  }
  await new Promise(r => setTimeout(r, 700))
}

writeFileSync("/tmp/platform_name_test.json", JSON.stringify(out, null, 1))
console.log("\n✅ تم — النتائج في /tmp/platform_name_test.json")
