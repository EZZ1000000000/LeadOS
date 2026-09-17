// wa-finish-pair.mjs — إكمال الاقتران: تعبئة الرقم + التالي + استخراج كود الاقتران
// يعمل على الجلسة الحية "wa" (المفروض الفورم مفتوح ومصر مختارة)
const BASE = "http://127.0.0.1:9797"
const PHONE = "1067804629"

async function call(path, body, timeoutMs = 130000) {
  const r = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) })
  const j = await r.json().catch(() => ({}))
  if (!j.ok) throw new Error(`${path} فشل: ${JSON.stringify(j).slice(0, 300)}`)
  return j
}
const wait = (ms) => new Promise((res) => setTimeout(res, ms))
const evalJs = async (script) => (await call("/act", { session: "wa", action: "eval", script })).result

// 0) تأكيد أن الفورم مفتوح ومصر ظاهرة
const state = await evalJs("() => (document.body ? document.body.innerText : '')")
const st = String(state || "")
console.log("حالة الصفحة:", st.replace(/\n+/g, " | ").slice(0, 300))
if (!/مصر|\+\s?20/.test(st)) { console.error("✗ مصر غير ظاهرة — أعِد فتح الفورم أولًا"); process.exit(1) }

// 1) تعبئة الرقم في حقل الهاتف (native setter عشان React)
const filled = await evalJs(`() => {
  const ins = [...document.querySelectorAll('input')].filter(i => i.offsetParent !== null)
  const tel = ins.find(i => i.type === 'tel') || ins.find(i => /رقم|phone/i.test((i.getAttribute('aria-label') || '') + (i.placeholder || ''))) || ins[0]
  if (!tel) return null
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(tel, '${PHONE}')
  tel.dispatchEvent(new Event('input', { bubbles: true }))
  tel.dispatchEvent(new Event('change', { bubbles: true }))
  return { value: tel.value, aria: tel.getAttribute('aria-label') || '' }
}`)
console.log("بعد التعبئة:", JSON.stringify(filled))
if (!filled || String(filled.value).replace(/\D/g, "") !== PHONE) {
  console.error("✗ الرقم لم يُكتب بشكل صحيح")
  process.exit(2)
}

// 2) زر التالي
const nx = await evalJs(`() => {
  const els = [...document.querySelectorAll('button, [role="button"]')]
  const vis = e => e.offsetParent !== null
  const txt = e => (e.innerText || '').trim()
  const m = els.find(e => vis(e) && /^(التالي|متابعة|Next|Continue)$/.test(txt(e))) || els.find(e => vis(e) && /التالي|Next/.test(txt(e)) && txt(e).length < 40)
  if (!m) return null
  m.click()
  return txt(m).slice(0, 30)
}`)
if (!nx) { console.error("✗ زر التالي غير موجود"); process.exit(3) }
console.log("ضغطت التالي ✓")

// 3) انتظار كود الاقتران (حتى 45 ثانية)
const codeRe = /\b([A-Z0-9]{4})\s?[-–—]?\s?([A-Z0-9]{4})\b/g
let code = null, pageText = ""
for (let i = 0; i < 22 && !code; i++) {
  await wait(2000)
  pageText = String(await evalJs("() => (document.body ? document.body.innerText : '')") || "")
  const cands = []
  for (const m of pageText.matchAll(codeRe)) {
    const joined = m[1] + m[2]
    if (/^[A-Z0-9]{8}$/.test(joined) && !/^(WhatsApp|LINKEDIN)$/i.test(joined)) cands.push(m[1] + "-" + m[2])
  }
  if (cands.length) code = cands[cands.length - 1]
  process.stdout.write(".")
}
console.log("")
if (!code) {
  console.error("✗ لم يظهر كود — نص الصفحة:\n" + pageText.slice(0, 1500))
  process.exit(4)
}
console.log("\n==========================================")
console.log("✅ كود الاقتران: " + code)
console.log("==========================================")
const idx = pageText.indexOf(code.slice(0, 4))
if (idx >= 0) console.log("\n[السياق]\n" + pageText.slice(Math.max(0, idx - 350), idx + 450))
