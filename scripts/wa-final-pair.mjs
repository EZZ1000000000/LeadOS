// wa-final-pair.mjs — الفلو النهائي: مصر (ضغطة حقيقية) → p.fill للرقم → التالي → الكود
// القاعدة الذهبية: لا native-setter يدوي على حقل React — فقط ضغطات ماوس حقيقية + p.fill
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
const pageText = async () => String(await evalJs("() => (document.body ? document.body.innerText : '')") || "")

// 0) افتح فورم الرقم لو لسا مش مفتوح
let st = await pageText()
if (!/أدخل رقم الهاتف/.test(st)) {
  console.log("إعادة فتح شاشة الدخول برقم الهاتف ...")
  await call("/navigate", { session: "wa", url: "https://web.whatsapp.com/", wait_until: "domcontentloaded", timeout: 60000 })
  await wait(7000)
  await evalJs(`() => {
    const els = [...document.querySelectorAll('button, a, [role="button"]')]
    const vis = e => e.offsetParent !== null
    const txt = e => ((e.innerText || '') + ' ' + (e.getAttribute('aria-label') || '')).trim()
    const cands = els.filter(e => vis(e) && /رقم الهاتف|phone number/i.test(txt(e)) && txt(e).length < 80)
    cands.sort((a, b) => (/تسجيل الدخول/.test(txt(a)) ? -1 : 1) - (/تسجيل الدخول/.test(txt(b)) ? -1 : 1) || txt(a).length - txt(b).length)
    if (cands[0]) cands[0].click()
    return cands[0] ? 'clicked' : null
  }`)
  await wait(3500)
  st = await pageText()
  if (!/أدخل رقم الهاتف/.test(st)) { console.error("✗ الفورم لم يُفتح:\n" + st.slice(0, 500)); process.exit(1) }
}
console.log("فورم الرقم مفتوح ✓")

// لا داعي لقايمة الدولة: كتابة الرقم بالصيغة الدولية +20... تجعل واتساب يختار مصر تلقائيًا
// 1) ضغطة حقيقية على حقل الرقم ثم p.fill بالصيغة الدولية
await evalJs(`() => {
  const ins = [...document.querySelectorAll('input')].filter(i => i.offsetParent !== null)
  const tel = ins.find(i => i.type === 'tel') || ins.find(i => /رقم|phone/i.test((i.getAttribute('aria-label') || '') + (i.placeholder || ''))) || ins[0]
  if (!tel) return null
  tel.id = 'leados-phone-input'
  return tel.id
}`)
await call("/act", { session: "wa", action: "click", selector: "#leados-phone-input", timeout: 15000 })
await wait(600)
await call("/act", { session: "wa", action: "type", selector: "#leados-phone-input", text: "+20" + PHONE, timeout: 15000 })
await wait(1500)

// 2) تحقق من نص الصفحة: مصر +20 والرقم
st = await pageText()
const digits = st.replace(/\D/g, "")
console.log("نص الصفحة بعد التعبئة:", st.replace(/\n+/g, " | ").slice(0, 260))
if (!/مصر/.test(st) || !digits.includes(PHONE)) {
  console.error("✗ الرقم/الدولة لم يستقرا في الصفحة")
  process.exit(5)
}
console.log("مصر +20 والرقم 1067804629 ظاهران ✓")

// 3) التالي بضغطة حقيقية
const nt = await evalJs(`() => {
  const els = [...document.querySelectorAll('button, [role="button"]')]
  const m = els.find(e => e.offsetParent !== null && /^(التالي|متابعة|Next|Continue)$/.test((e.innerText || '').trim()))
  if (!m) return null
  m.id = 'leados-next-btn'
  return (m.innerText || '').slice(0, 20)
}`)
if (!nt) { console.error("✗ زر التالي غير موجود:\n" + (await pageText()).slice(0, 400)); process.exit(6) }
await call("/act", { session: "wa", action: "click", selector: "#leados-next-btn", timeout: 15000 })
console.log("ضغطت التالي ✓")

// 4) انتظار الكود
const codeRe = /\b([A-Z0-9]{4})\s?[-–—]?\s?([A-Z0-9]{4})\b/g
let code = null, txt2 = ""
for (let i = 0; i < 22 && !code; i++) {
  await wait(2000)
  txt2 = await pageText()
  const cands = []
  for (const m of txt2.matchAll(codeRe)) {
    const joined = m[1] + m[2]
    if (/^[A-Z0-9]{8}$/.test(joined) && !/^(WHATSAPP|LINKEDIN)$/.test(joined)) cands.push(m[1] + "-" + m[2])
  }
  if (cands.length) code = cands[cands.length - 1]
  process.stdout.write(".")
}
console.log("")
if (!code) { console.error("✗ لم يظهر كود — نص الصفحة:\n" + txt2.slice(0, 1200)); process.exit(7) }
console.log("\n==========================================")
console.log("✅ كود الاقتران: " + code)
console.log("==========================================")
const idx = txt2.indexOf(code.slice(0, 4))
if (idx >= 0) console.log("\n[السياق]\n" + txt2.slice(Math.max(0, idx - 350), idx + 450))
