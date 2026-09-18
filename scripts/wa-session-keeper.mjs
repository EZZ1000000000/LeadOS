// wa-session-keeper.mjs — حارس جلسة واتساب لزيزو (الآلية الرسمية المعتمدة من المستخدم)
// ─────────────────────────────────────────────────────────────────────────────
// السياسة: الجلسة محفوظة في بروفايل كاموفوكس الدائم (~/.leados/camoufox-profile).
// لو الجلسة ضاعت: زيزو يبدأ الاقتران برقم الهاتف (WHATSAPP_NUMBER من .env)،
// يطبع الكود هنا في الشات، والمستخدم يدخله على موبايله (الأجهزة المرتبطة → ربط جهاز → الربط برقم الهاتف).
//
// الاستخدام:
//   node scripts/wa-session-keeper.mjs          → فحص + استرداد تلقائي (يبدأ الاقتران لو الجلسة ضاعت ويطبع الكود)
//   node scripts/wa-session-keeper.mjs code     → استخراج الكود المعروض حاليًا فقط (الأسرع — ثواني)
//   node scripts/wa-session-keeper.mjs check    → فحص الحالة فقط بدون أي إجراء
//   node scripts/wa-session-keeper.mjs pair     → إعادة اقتران كاملة من الصفر (كود جديد مضمون)

import { readFileSync } from "node:fs"

const BASE = "http://127.0.0.1:9797"
const MODE = (process.argv[2] || "auto").toLowerCase()

// رقم زيزو من .env (WHATSAPP_NUMBER) — fallback 201067804629
let PHONE_INTL = "+201067804629"
try {
  const env = readFileSync("/home/z/my-project/.env", "utf8")
  const m = env.match(/^WHATSAPP_NUMBER=(\+\d+)\s*$/m)
  if (m) PHONE_INTL = m[1]
} catch {}
const PHONE_NATIONAL = PHONE_INTL.replace(/^\+\d{2}/, "")

async function call(path, body, timeoutMs = 130000) {
  const r = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) })
  const j = await r.json().catch(() => ({}))
  if (!j.ok) throw new Error(`${path} فشل: ${JSON.stringify(j).slice(0, 300)}`)
  return j
}
const wait = (ms) => new Promise((res) => setTimeout(res, ms))
const evalJs = async (script) => (await call("/act", { session: "wa", action: "eval", script })).result
const pageText = async () => String(await evalJs("() => (document.body ? document.body.innerText : '')") || "")

// استخراج كود الاقتران من الحروف الرأسية (كل حرف في سطر): 4 حروف + شرطة + 4 حروف
function extractCode(text) {
  const re = /([A-Z0-9])\n([A-Z0-9])\n([A-Z0-9])\n([A-Z0-9])\n-\n([A-Z0-9])\n([A-Z0-9])\n([A-Z0-9])\n([A-Z0-9])\n/g
  let last = null
  for (const m of text.matchAll(re)) last = `${m[1]}${m[2]}${m[3]}${m[4]}-${m[5]}${m[6]}${m[7]}${m[8]}`
  return last
}

function classify(text) {
  if (/أدخل الكود على الهاتف/.test(text)) return "PAIRING"
  if (/المسح ضوئيًا لتسجيل الدخول|تسجيل الدخول برقم الهاتف/.test(text)) return "LOGIN"
  if (/الدردشات|Chats|رسالة جديدة|تحديث الحالة/.test(text) && !/تسجيل الدخول/.test(text)) return "ALIVE"
  return "UNKNOWN"
}

// فتح شاشة الاقتران برقم الهاتف من شاشة QR/الدخول
async function openPhoneLogin() {
  await call("/navigate", { session: "wa", url: "https://web.whatsapp.com/", wait_until: "domcontentloaded", timeout: 60000 })
  await wait(7000)
  let t = await pageText()
  if (/أدخل رقم الهاتف/.test(t)) return true
  const clicked = await evalJs(`() => {
    const els = [...document.querySelectorAll('button, a, [role="button"]')]
    const vis = e => e.offsetParent !== null
    const txt = e => ((e.innerText || '') + ' ' + (e.getAttribute('aria-label') || '')).trim()
    const cands = els.filter(e => vis(e) && /رقم الهاتف|رقم التليفون|phone number/i.test(txt(e)) && txt(e).length < 80)
    cands.sort((a, b) => (/تسجيل الدخول|Log in/i.test(txt(a)) ? -1 : 1) - (/تسجيل الدخول|Log in/i.test(txt(b)) ? -1 : 1) || txt(a).length - txt(b).length)
    if (!cands[0]) return null
    cands[0].click()
    return (cands[0].innerText || '').slice(0, 60)
  }`)
  if (!clicked) return false
  await wait(3500)
  t = await pageText()
  return /أدخل رقم الهاتف/.test(t)
}

// الفلو الكامل: فورم الرقم → +20... → التالي → استخراج الكود
async function pairFlow() {
  const opened = await openPhoneLogin()
  if (!opened) return { err: "لم أستطع فتح فورم رقم الهاتف" }
  await evalJs(`() => {
    const ins = [...document.querySelectorAll('input')].filter(i => i.offsetParent !== null)
    const tel = ins.find(i => i.type === 'tel') || ins.find(i => /رقم|phone/i.test((i.getAttribute('aria-label') || '') + (i.placeholder || ''))) || ins[0]
    if (tel) tel.id = 'leados-phone-input'
    return tel ? 'tagged' : null
  }`)
  await call("/act", { session: "wa", action: "click", selector: "#leados-phone-input", timeout: 15000 })
  await wait(600)
  // الصيغة الدولية الكاملة تجعل واتساب يختار مصر تلقائيًا (الأرقام المحلية "1..." تُفسر أمريكا!)
  await call("/act", { session: "wa", action: "type", selector: "#leados-phone-input", text: PHONE_INTL, timeout: 15000 })
  await wait(1500)
  const t1 = await pageText()
  if (!/مصر/.test(t1) || !t1.replace(/\D/g, "").includes(PHONE_NATIONAL)) return { err: "الرقم لم يستقر: " + t1.replace(/\n+/g, " | ").slice(0, 160) }
  const nt = await evalJs(`() => {
    const els = [...document.querySelectorAll('button, [role="button"]')]
    const m = els.find(e => e.offsetParent !== null && /^(التالي|متابعة|Next|Continue)$/.test((e.innerText || '').trim()))
    if (!m) return null
    m.click()
    return (m.innerText || '').trim()
  }`)
  if (!nt) return { err: "زر التالي غير موجود" }
  // انتظار ظهور الكود
  for (let i = 0; i < 22; i++) {
    await wait(2000)
    const t = await pageText()
    const code = extractCode(t)
    if (code) return { state: "PAIRING", code }
  }
  return { err: "انتهى الانتظار بدون كود — الحالة: " + classify(await pageText()) }
}

// ═══ الأنماط ═══
if (MODE === "code") {
  // الأسرع: الكود المعروض حاليًا على الشاشة (بدون أي تصفح)
  const t = await pageText()
  const code = extractCode(t)
  if (code) {
    console.log(JSON.stringify({ state: "PAIRING", code, note: "كود حي من الشاشة الحالية" }, null, 1))
  } else {
    console.error(JSON.stringify({ err: "لا يوجد كود على الشاشة الحالية — الحالة: " + classify(t) + " — شغّل الوضع الافتراضي أو pair" }))
    process.exit(1)
  }
} else if (MODE === "check") {
  const t = await pageText()
  const state = classify(t)
  const code = state === "PAIRING" ? extractCode(t) : null
  console.log(JSON.stringify({ state, code, url: "https://web.whatsapp.com/" }, null, 1))
} else if (MODE === "pair") {
  const res = await pairFlow()
  console.log(JSON.stringify(res, null, 1))
  if (res.err) process.exit(1)
} else {
  // auto: فحص ثم استرداد ذكي
  let t = await pageText()
  let state = classify(t)
  if (state === "PAIRING") {
    console.log(JSON.stringify({ state, code: extractCode(t), note: "شاشة اقتران قائمة — الكود الحي" }, null, 1))
  } else if (state === "ALIVE") {
    console.log(JSON.stringify({ state, note: "الجلسة حية — واتساب ويب متصل بخط " + PHONE_INTL }, null, 1))
  } else if (state === "LOGIN" || state === "UNKNOWN") {
    console.log("الجلسة ضاعت (" + state + ") — بدء الاقتران برقم الهاتف ...")
    const res = await pairFlow()
    console.log(JSON.stringify(res, null, 1))
    if (res.err) process.exit(1)
  }
}
