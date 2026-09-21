import { classifyPost } from "../src/lib/monitors/segments"

const tests: Array<[string, string]> = [
  ["أنا مفتتح كافيه جديد في مدينة نصر ومحتاج سستم كروت نت للواي فاي، حد يرشح؟", "CARDS"],
  ["محتاج شركة ميديا بينج لإدارة إعلانات ممولة للمطعم بتاعي، بكام؟", "AGENCY"],
  ["كافيهي محتاج تصوير احترافي للمنيو وحملة إعلانات على فيسبوك", "BOTH"],
  ["عايز موقع إلكتروني لمكتب عقارات", "AGENCY"],
  ["حد يعرف مبرمج يعمل تطبيق دليفري للكافيه؟", "BOTH"],
  ["مطلوب نظام كروت انترنت للمقهى بتاعي مع كاشير", "CARDS"],
  ["عرض شغل: مطلوب مصور فوتوغرافي", "AGENCY"],
]

let pass = 0
for (const [text, expected] of tests) {
  const r = classifyPost(text)
  const ok = r.segment === expected
  if (ok) pass++
  console.log(`${ok ? "✅" : "❌"} seg=${r.segment} (متوقع ${expected}) score=${r.score} kw=[${r.matchedKeywords.slice(0,3).join(",")}] "${text.slice(0, 50)}"`)
}
console.log(`\n${pass}/${tests.length} صح`)
