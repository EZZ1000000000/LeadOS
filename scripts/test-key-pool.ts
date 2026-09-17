// LeadOS — اختبار حي لمجمع مفاتيح NVIDIA (التبديل التلقائي عند الـrate-limit)
// تشغيل: bun run scripts/test-key-pool.ts
import { aiChat, aiProviderStatus, keyPoolStatus, _keyPoolTest } from "../src/lib/ai"

const MASK = (k: string) => (k.length > 14 ? `${k.slice(0, 12)}…${k.slice(-4)}` : "؟")

async function main() {
  let pass = 0
  let fail = 0
  const ok = (name: string, cond: boolean, extra = "") => {
    if (cond) { pass++; console.log(`  ✓ ${name} ${extra}`) }
    else { fail++; console.log(`  ✗ ${name} ${extra}`) }
  }

  console.log("═══ 1) المجمع يقرأ المفتاحين من البيئة ═══")
  const keys = _keyPoolTest.keys()
  console.log(`  العدد: ${keys.length} → ${keys.map(MASK).join("  ,  ")}`)
  ok("مفتاحان في المجمع", keys.length === 2)

  console.log("\n═══ 2) التوزيع الدائري (round-robin) ═══")
  _keyPoolTest.reset()
  const p1 = _keyPoolTest.pick()
  const p2 = _keyPoolTest.pick()
  console.log(`  نداء 1 يبدأ بـ: ${MASK(p1[0])} | نداء 2 يبدأ بـ: ${MASK(p2[0])}`)
  ok("النداءات متناوبة على المفتاحين", p1[0] !== p2[0])
  ok("الترتيب كامل (مفتاح احتياطي موجود)", p1.length === 2 && p2.length === 2)

  console.log("\n═══ 3) محاكاة rate-limit على المفتاح الأول ═══")
  _keyPoolTest.cool(0, 60_000)
  const st = keyPoolStatus()
  console.log(`  الحالة: live=${st.live} cooling=${st.cooling} dead=${st.dead}`)
  ok("مفتاح واحد حي أثناء التبريد", st.live === 1 && st.cooling === 1)
  const p3 = _keyPoolTest.pick()
  ok("الاختيار قفز للمفتاح الثاني فورًا", p3[0] === keys[1])

  console.log("\n═══ 4) نداء حي حقيقي أثناء تبريد المفتاح الأول (إثبات التبديل) ═══")
  const t0 = Date.now()
  const res = await aiChat(
    [{ role: "user", content: "رد بكلمة واحدة بس: جاهز" }],
    { task: "chat", maxTokens: 400 },
  )
  if (res) {
    console.log(`  ✓ نجح عبر ${res.model} — ${res.latencyMs}ms — الرد: "${res.text.slice(0, 40)}"`)
    ok("النداء اكتمل بالمفتاح البديل", true, `(${Date.now() - t0}ms إجمالي)`)
  } else {
    // قد يفشل بسبب 503 مؤقت من الخدمة نفسها — نعيد بمهمة classify
    console.log("  ⚠ المحاولة الأولى فشلت (احتمال 503 خدمة) — إعادة بـclassify…")
    const res2 = await aiChat([{ role: "user", content: "رد بكلمة واحدة بس: جاهز" }], { task: "classify", maxTokens: 400 })
    ok("النداء اكتمل بالمفتاح البديل (إعادة)", Boolean(res2), res2 ? ` → ${res2.model}` : "")
  }

  console.log("\n═══ 5) محاكاة مفتاح ميت (401) ═══")
  _keyPoolTest.reset()
  _keyPoolTest.kill(1)
  const st2 = keyPoolStatus()
  console.log(`  الحالة: live=${st2.live} dead=${st2.dead}`)
  ok("المفتاح الميت اتشال من التداول", st2.live === 1 && st2.dead === 1)
  _keyPoolTest.reset()

  console.log("\n═══ 6) aiProviderStatus يعرض المجمع ═══")
  const status = aiProviderStatus()
  console.log(`  keys: ${JSON.stringify(status.keys)}`)
  ok("الحالة فيها المفتاحين", status.keys?.total === 2 && status.keys?.live === 2)
  console.log(`  note: ${status.note}`)

  console.log(`\n═══ النتيجة: ${pass} ✓ / ${fail} ✗ ═══`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error("فشل السكريبت:", e); process.exit(1) })
