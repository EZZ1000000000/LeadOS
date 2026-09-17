// test-fb-dom-inspect.mjs — فحص بنية زر متابعة وعمل click حقيقي
const post = async (endpoint, body, timeout = 150_000) => {
  const r = await fetch(`http://127.0.0.1:9797${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  })
  return r.json().catch(() => ({}))
}

// 1) هيكل الأزرار والفورمات
const dom = await post("/act", {
  session: "default",
  action: "eval",
  script: `(() => {
    const info = []
    document.querySelectorAll('button, [role="button"], form, input[type="submit"]').forEach((el, i) => {
      if (i > 15) return
      info.push({
        tag: el.tagName,
        type: el.getAttribute('type') || '',
        role: el.getAttribute('role') || '',
        text: (el.innerText || el.value || '').trim().slice(0, 30),
        action: el.getAttribute('action') || '',
        method: el.getAttribute('method') || '',
        visible: el.offsetParent !== null,
        cls: (el.className || '').toString().slice(0, 60),
      })
    })
    return JSON.stringify(info)
  })()`,
})
console.log("DOM:", dom.result)

// 2) click حقيقي على زر متابعة الظاهر
const click = await post("/act", {
  session: "default",
  action: "click",
  selector: `div[role="button"]:has-text("متابعة")`,
  timeout: 20_000,
})
console.log("Click حقيقي:", JSON.stringify(click).slice(0, 300))

// 3) النتيجة
await new Promise((res) => setTimeout(res, 10_000))
const state = await post("/act", {
  session: "default",
  action: "eval",
  script: "JSON.stringify({url: location.href.slice(0,120), title: document.title.slice(0,80), body: document.body.innerText.slice(0, 300)})",
})
console.log("بعد الضغطة:", state.result)
