// wa-phone-login.mjs — ربط واتساب ويب بالمتصفح الستيلث عبر "تسجيل الدخول برقم الهاتف"
// الاستخدام: node scripts/wa-phone-login.mjs [رقم بمقياس دولي بدون + مثال: 201067804629]
// المراحل: فتح الموقع → الضغط على "رقم الهاتف" → تعبئة الرقم → التالي → استخراج كود الاقتران
const BASE = "http://127.0.0.1:9797"

const RAW = process.argv[2] || "201067804629"
// نمسح كل شيء غير الأرقام ونتأكد من صيغة مصر (+20 ثم الرقم بلا صفير)
const digits = RAW.replace(/\D/g, "")
let cc = "20", national = digits
if (digits.startsWith("20")) national = digits.slice(2)
else if (digits.startsWith("0")) { national = digits.replace(/^0+/, ""); }
if (national.startsWith("0")) national = national.replace(/^0+/, "")
const PHONE = national // 1067804629
console.log(`الرقم المُدخل للفورم: كود الدولة ${cc} + ${PHONE} (من ${RAW})`)

async function call(path, body, timeoutMs = 130000) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const j = await r.json().catch(() => ({}))
  if (!j.ok) throw new Error(`${path} فشل: ${JSON.stringify(j).slice(0, 300)}`)
  return j
}
const wait = (ms) => new Promise((res) => setTimeout(res, ms))

// جلب نص الصفحة بدون إعادة تصفح (الـnavigate بيعمل reload ويبوّظ حالة الفورم!)
const getText = async () => {
  const t = await call("/act", { session: "wa", action: "eval", script: "() => document.body ? document.body.innerText : ''" })
  return String(t.result || "")
}

// أدوات مساعدة: سكربتات eval
const jsControls = `() => {
  const els = [...document.querySelectorAll('button, a, [role="button"], [role="combobox"], input, div[tabindex="0"]')]
  return els.filter(e => {
    const t = (e.innerText || e.getAttribute('aria-label') || e.getAttribute('placeholder') || '')
    return t.trim().length > 0
  }).slice(0, 60).map(e => ({
    tag: e.tagName, role: e.getAttribute('role') || '',
    type: e.type || '', aria: (e.getAttribute('aria-label') || '').slice(0, 60),
    text: (e.innerText || '').replace(/\\n/g, ' | ').slice(0, 80),
    ph: e.placeholder || '', disabled: !!e.disabled,
  }))
}`

// 1) فتح واتساب ويب
console.log("\n[1] فتح web.whatsapp.com ...")
const nav = await call("/navigate", { session: "wa", url: "https://web.whatsapp.com/", wait_until: "domcontentloaded", timeout: 60000 })
console.log("status:", nav.http_status, "| title:", nav.title, "| url:", nav.url)
await wait(7000) // الصفحة SPA تقيلة

await wait(4000)
const text = await getText()
console.log("\n[نص الصفحة — أول 900 حرف]\n" + text.slice(0, 900))

const controls = await call("/act", { session: "wa", action: "eval", script: jsControls })
console.log("\n[2] عناصر الصفحة القابلة للتفاعل:")
for (const c of controls.result || []) console.log(`  <${c.tag}${c.role ? " role=" + c.role : ""}${c.type ? " type=" + c.type : ""}> aria="${c.aria}" text="${c.text}" ph="${c.ph}"`)

// 3) إيجاد رابط "تسجيل الدخول برقم الهاتف" والضغط عليه بـ JS
console.log("\n[3] البحث عن خيار الدخول برقم الهاتف ...")
const finder = `() => {
  const els = [...document.querySelectorAll('button, a, [role="button"]')]
  const vis = e => e.offsetParent !== null
  const txt = e => ((e.innerText || '') + ' ' + (e.getAttribute('aria-label') || '')).trim()
  // العناصر المرشحة: قصيرة النص فقط (الزرار نفسه مش حاوية أب) وفيها "رقم الهاتف"
  const cands = els.filter(e => vis(e) && /رقم الهاتف|رقم التليفون|phone number/i.test(txt(e)) && txt(e).length < 80)
  if (!cands.length) return null
  // الأفضل: أقصر نص (الليف الحقيقي) — وفيه تفضيل لـ"تسجيل الدخول"
  cands.sort((a, b) => {
    const pa = /تسجيل الدخول|Log in/i.test(txt(a)) ? 0 : 1
    const pb = /تسجيل الدخول|Log in/i.test(txt(b)) ? 0 : 1
    return pa - pb || txt(a).length - txt(b).length
  })
  const m = cands[0]
  m.click()
  return { tag: m.tagName, text: (m.innerText || m.getAttribute('aria-label') || '').slice(0, 100) }
}`
const clicked = await call("/act", { session: "wa", action: "eval", script: finder })
if (!clicked.result) { console.error("✗ لم أجد عنصر رقم الهاتف — انظر العناصر أعلاه"); process.exit(2) }
console.log("تم الضغط على:", JSON.stringify(clicked.result))
await wait(3500)

const afterText = await getText()
console.log("\n[نص الصفحة بعد الضغط — أول 900 حرف]\n" + afterText.slice(0, 900))

// 3.5) لو الدولة مش مصر → افتح القائمة وابحث عن مصر واخترها
if (!/مصر|\+\s?20(?!\\d)|Egypt/i.test(afterText)) {
  console.log("\n[3.5] تغيير الدولة إلى مصر ...")
  const openCountry = `() => {
    const els = [...document.querySelectorAll('[role="combobox"], [role="button"], button, div[tabindex="0"]')]
    const m = els.find(e => e.offsetParent !== null && /هونغ كونغ|Hong Kong|852/.test((e.innerText || '') + (e.getAttribute('aria-label') || '')) && ((e.innerText || '') + (e.getAttribute('aria-label') || '')).trim().length < 80)
    if (!m) return null
    m.click()
    return { tag: m.tagName, text: ((m.innerText || '') + (m.getAttribute('aria-label') || '')).slice(0, 60) }
  }`
  const oc = await call("/act", { session: "wa", action: "eval", script: openCountry })
  if (!oc.result) { console.error("✗ لم أجد محدد الدولة"); process.exit(8) }
  console.log("فتحت:", JSON.stringify(oc.result))
  await wait(2500)

  // اكتب "مصر" في حقل البحث (native setter عشان React ياخد باله)
  const searchC = `() => {
    const ins = [...document.querySelectorAll('input')].filter(i => i.offsetParent !== null)
    const target = ins.find(i => i.type === 'search' || i.type === 'text') || ins[0]
    if (!target) return null
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(target, 'مصر')
    target.dispatchEvent(new Event('input', { bubbles: true }))
    return { type: target.type, ph: target.placeholder || '' }
  }`
  const sc = await call("/act", { session: "wa", action: "eval", script: searchC })
  console.log("بحث عن مصر:", JSON.stringify(sc.result))
  await wait(2000)

  // اطبع الخيارات الظاهرة ثم اختر مصر
  const optsDump = await call("/act", { session: "wa", action: "eval", script: `() => [...document.querySelectorAll('[role="option"], li')].filter(e => e.offsetParent !== null).slice(0, 15).map(e => (e.innerText || '').replace(/\\n/g, ' | ').slice(0, 60))` })
  console.log("الخيارات:", JSON.stringify(optsDump.result))
  const pickEgypt = `() => {
    const opts = [...document.querySelectorAll('[role="option"], li')].filter(e => e.offsetParent !== null)
    const cands = opts.filter(e => /مصر|Egypt/.test(e.innerText || '') && (e.innerText || '').length < 60)
    if (!cands.length) return null
    cands.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)
    const m = cands[0]
    m.click()
    return { tag: m.tagName, text: (m.innerText || '').slice(0, 60) }
  }`
  const pe = await call("/act", { session: "wa", action: "eval", script: pickEgypt })
  if (!pe.result) { console.error("✗ لم أجد خيار مصر في القائمة"); process.exit(9) }
  console.log("اخترت:", JSON.stringify(pe.result))
  await wait(2000)
} 

// فحص الدولة النهائي: لازم مصر +20 قبل أي طلب اقتران
const stateText = await getText()
if (!/مصر|\+\s?20(?!\\d)|Egypt/i.test(stateText)) {
  console.error("✗ لم أتأكد أن كود الدولة هو مصر (+20) — لا أضغط التالي رقمًا خاطئًا. النص:\n" + stateText.slice(0, 900))
  process.exit(7)
}
console.log("كود الدولة يبدو مصر (+20) ✓")

const inputs = await call("/act", { session: "wa", action: "eval", script: `() => [...document.querySelectorAll('input, [role="combobox"], [role="listbox"]')].map(i => ({ tag: i.tagName, type: i.type || '', aria: i.getAttribute('aria-label') || '', ph: i.placeholder || '', value: (i.value || '').slice(0, 30), visible: !!i.offsetParent, box: i.getBoundingClientRect ? (() => { const b = i.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)].join('x') })() : '' }))` })
console.log("\n[4] الحقول الحالية:")
for (const i of inputs.result || []) console.log(`  <${i.tag} type=${i.type} visible=${i.visible} box=${i.box}> aria="${i.aria}" ph="${i.ph}" value="${i.value}"`)

// 5) تعبئة الرقم (حقل tel أو أول input ظاهر)
console.log("\n[5] تعبئة الرقم ...")
const pickTel = `() => {
  const ins = [...document.querySelectorAll('input')].filter(i => i.offsetParent !== null)
  const tel = ins.find(i => i.type === 'tel') || ins.find(i => /رقم|phone/i.test(i.placeholder + ' ' + (i.getAttribute('aria-label') || ''))) || ins[0]
  if (!tel) return null
  return { found: true, type: tel.type, ph: tel.placeholder || '', aria: tel.getAttribute('aria-label') || '' }
}`
const telInfo = await call("/act", { session: "wa", action: "eval", script: pickTel })
if (!telInfo.result) { console.error("✗ لا يوجد حقل إدخال ظاهر"); process.exit(3) }
console.log("الحقل المختار:", JSON.stringify(telInfo.result))

// مرشحات CSS آمنة: type=tel الأول، وإلا input الظاهر الأول
let fillSel = 'input[type="tel"]'
try { await call("/act", { session: "wa", action: "type", selector: fillSel, text: PHONE, timeout: 10000 }) }
catch {
  fillSel = "input"
  await call("/act", { session: "wa", action: "type", selector: fillSel, text: PHONE, timeout: 10000 })
}
const ver = await call("/act", { session: "wa", action: "eval", script: `() => { const i = [...document.querySelectorAll('input')].filter(i => i.offsetParent !== null); const t = i.find(x => x.type === 'tel') || i[0]; return t ? t.value : null }` })
console.log("قيمة الحقل بعد الكتابة:", JSON.stringify(ver.result))
if (String(ver.result || "").replace(/\D/g, "") !== PHONE) {
  console.error("✗ الرقم لم يُكتب كما هو متوقع — راجع القيمة أعلاه")
  process.exit(4)
}

// 6) زر التالي
console.log("\n[6] الضغط على التالي ...")
const nextFinder = `() => {
  const els = [...document.querySelectorAll('button, [role="button"], a, div[tabindex="0"], span')]
  const vis = e => e.offsetParent !== null
  const txt = e => (e.innerText || '').trim()
  let m = els.find(e => /^(التالي|متابعة|Next|Continue)\\s*$/.test(txt(e)) && vis(e))
  if (!m) m = els.find(e => /التالي|Next/.test(txt(e)) && vis(e) && txt(e).length < 40)
  if (!m) return null
  m.click()
  return { tag: m.tagName, text: txt(m).slice(0, 40) }
}`
const nx = await call("/act", { session: "wa", action: "eval", script: nextFinder })
if (!nx.result) {
  console.error("✗ لم أجد زر التالي — النص الحالي:")
  console.error((await getText()).slice(0, 1200))
  process.exit(5)
}
console.log("تم الضغط:", JSON.stringify(nx.result))

// 7) استخراج كود الاقتران (poll حتى 40 ثانية)
console.log("\n[7] انتظار كود الاقتران ...")
const codeRe = /\b([A-Z0-9]{4})\s?[-–—]?\s?([A-Z0-9]{4})\b/g
let code = null, snapshotText = ""
for (let i = 0; i < 20 && !code; i++) {
  await wait(2000)
  const t = await call("/act", { session: "wa", action: "eval", script: "() => document.body ? document.body.innerText : ''" })
  snapshotText = String(t.result || "")
  const candidates = []
  for (const m of snapshotText.matchAll(codeRe)) {
    const joined = m[1] + m[2]
    if (/^[A-Z0-9]{8}$/.test(joined)) candidates.push(m[1] + "-" + m[2])
  }
  if (candidates.length) code = candidates[candidates.length - 1]
  process.stdout.write(".")
}
console.log("")

if (!code) {
  console.error("✗ لم يظهر كود — نص الصفحة الأخير (أول 1500 حرف):\n" + snapshotText.slice(0, 1500))
  process.exit(6)
}

console.log("\n==========================================")
console.log("✅ كود الاقتران: " + code)
console.log("==========================================")
// نص المساعدة الظاهر حول الكود (للتوثيق)
const idx = snapshotText.indexOf(code.slice(0, 4))
if (idx >= 0) console.log("\n[سياق الكود في الصفحة]\n" + snapshotText.slice(Math.max(0, idx - 400), idx + 400))
