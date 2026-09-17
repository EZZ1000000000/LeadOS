// wa-select-egypt.mjs — اختيار مصر بضغطة ماوس حقيقية ثم تعبئة الرقم والتالي واستخراج الكود
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

// 0) لو القائمة مقفولة → افتحها بضغطة حقيقية على زر الدولة
let st = String(await evalJs("() => (document.body ? document.body.innerText : '')") || "")
const listOpen = /آيسلندا|إثيوبيا|أذربيجان/.test(st)
if (!listOpen) {
  console.log("القائمة مقفولة — أفتحها ...")
  await evalJs(`() => {
    const els = [...document.querySelectorAll('[role="button"], button')]
    const m = els.find(e => e.offsetParent !== null && /تحديد الدولة|الولايات المتحدة|هونغ كونغ/.test((e.innerText || '') + (e.getAttribute('aria-label') || '')))
    if (m) { m.id = 'leados-country-btn' }
    return m ? m.innerText : null
  }`)
  await call("/act", { session: "wa", action: "click", selector: "#leados-country-btn", timeout: 10000 })
  await wait(2000)
}

// 1) سكرول لمصر + وسم السطر بـid مؤقت
const tag = await evalJs(`async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (e) => e.offsetParent !== null
  const lb = document.querySelector('[role="listbox"]')
  if (!lb) return { err: 'no listbox' }
  let scroller = [...lb.querySelectorAll('*')].find(el => el.scrollHeight > el.clientHeight + 100) || lb
  let found = null, lastTop = -1
  for (let i = 0; i < 80 && !found; i++) {
    const items = [...lb.querySelectorAll('[role="listitem"], [role="option"], li')].filter(vis)
    found = items.find(e => /مصر/.test(e.innerText || ''))
    if (!found) {
      if (Math.abs(scroller.scrollTop - lastTop) < 1 && i > 2) break
      lastTop = scroller.scrollTop
      scroller.scrollTop = scroller.scrollTop + 600
      await sleep(200)
    }
  }
  if (!found) return { err: 'مصر غير موجودة' }
  // وسّم أعمق صف (السطر نفسه مش غلاف)
  let row = found
  while (row.parentElement && row.parentElement.getAttribute('role') === 'listitem') row = row.parentElement
  // خد العنصر الذي نصه كامل "مصر +20" — الأدق: أول listitem نصه يبدأ بمصر
  const cand = [...lb.querySelectorAll('[role="listitem"]')].filter(vis).find(e => /^مصر/.test((e.innerText || '').trim()))
  const target = cand || row
  target.id = 'leados-egypt-row'
  return { txt: (target.innerText || '').replace(/\\n/g, ' ').slice(0, 40), top: scroller.scrollTop }
}`)
console.log("وسم السطر:", JSON.stringify(tag))
if (!tag || tag.err) { console.error("✗ " + (tag?.err || "فشل الوسم")); process.exit(1) }

// 2) ضغطة ماوس حقيقية على السطر
await call("/act", { session: "wa", action: "click", selector: "#leados-egypt-row", timeout: 15000 })
await wait(2000)

// 3) تحقق: مصر ظاهرة والقائمة مقفولة
st = String(await evalJs("() => (document.body ? document.body.innerText : '')") || "")
const okCountry = /مصر/.test(st) && /\+\s?20/.test(st) && !/آيسلندا|إثيوبيا/.test(st)
console.log("حالة الدولة بعد الضغط:", st.replace(/\n+/g, " | ").slice(0, 220))
if (!okCountry) { console.error("✗ مصر لم تُحدد فعليًا"); process.exit(2) }
console.log("مصر +20 محددة ✓")

// 4) تعبئة الرقم (تفريغ أولًا ثم كتابة)
const filled = await evalJs(`() => {
  const ins = [...document.querySelectorAll('input')].filter(i => i.offsetParent !== null)
  const tel = ins.find(i => i.type === 'tel') || ins.find(i => /رقم|phone/i.test((i.getAttribute('aria-label') || '') + (i.placeholder || ''))) || ins[0]
  if (!tel) return null
  const proto = window.HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
  setter.call(tel, '')
  tel.dispatchEvent(new Event('input', { bubbles: true }))
  setter.call(tel, '${PHONE}')
  tel.dispatchEvent(new Event('input', { bubbles: true }))
  tel.dispatchEvent(new Event('change', { bubbles: true }))
  return { value: tel.value }
}`)
console.log("بعد التعبئة:", JSON.stringify(filled))
if (!filled || !String(filled.value).includes("067804629")) { console.error("✗ الرقم لم يُكتب"); process.exit(3) }

// 5) التالي بضغطة حقيقية
await evalJs(`() => {
  const els = [...document.querySelectorAll('button, [role="button"]')]
  const m = els.find(e => e.offsetParent !== null && /^(التالي|متابعة|Next|Continue)$/.test((e.innerText || '').trim()))
  if (m) m.id = 'leados-next-btn'
  return m ? 'tagged' : null
}`)
await call("/act", { session: "wa", action: "click", selector: "#leados-next-btn", timeout: 15000 })
console.log("ضغطت التالي ✓")

// 6) انتظار كود الاقتران
const codeRe = /\b([A-Z0-9]{4})\s?[-–—]?\s?([A-Z0-9]{4})\b/g
let code = null, pageText = ""
for (let i = 0; i < 22 && !code; i++) {
  await wait(2000)
  pageText = String(await evalJs("() => (document.body ? document.body.innerText : '')") || "")
  const cands = []
  for (const m of pageText.matchAll(codeRe)) {
    const joined = m[1] + m[2]
    if (/^[A-Z0-9]{8}$/.test(joined) && !/^(WHATSAPP|LINKEDIN)$/.test(joined)) cands.push(m[1] + "-" + m[2])
  }
  if (cands.length) code = cands[cands.length - 1]
  process.stdout.write(".")
}
console.log("")
if (!code) { console.error("✗ لم يظهر كود — نص الصفحة:\n" + pageText.slice(0, 1200)); process.exit(4) }
console.log("\n==========================================")
console.log("✅ كود الاقتران: " + code)
console.log("==========================================")
const idx = pageText.indexOf(code.slice(0, 4))
if (idx >= 0) console.log("\n[السياق]\n" + pageText.slice(Math.max(0, idx - 350), idx + 450))
