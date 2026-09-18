// test-fb-one-touch.mjs — ضغطة "متابعة" للدخول الموحد (one-touch login)
const post = async (endpoint, body, timeout = 150_000) => {
  const r = await fetch(`http://127.0.0.1:9797${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  })
  return r.json().catch(() => ({}))
}

// 1) دوّر على زر متابعة/Continue
const find = await post("/act", {
  session: "default",
  action: "eval",
  script: `(() => {
    const btns = Array.from(document.querySelectorAll('button, [role="button"], a, input[type="submit"]'))
      .map(b => ({ tag: b.tagName, text: (b.innerText || b.value || '').trim().slice(0, 40), name: b.name || '', id: b.id || '' }))
      .filter(b => /متابعة|Continue|تسجيل الدخول|Log in/i.test(b.text + ' ' + b.name))
      .slice(0, 10)
    return JSON.stringify(btns)
  })()`,
})
console.log("الأزرار:", find.result)

// 2) اضغط أول زر متابعة
const click = await post("/act", {
  session: "default",
  action: "eval",
  script: `(() => {
    const btn = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'))
      .find(b => (b.innerText || b.value || '').trim() === 'متابعة' || b.value === 'متابعة')
    if (!btn) return 'NO_BUTTON'
    btn.click()
    return 'CLICKED: ' + (btn.innerText || btn.value).slice(0, 30)
  })()`,
})
console.log("الضغطة:", click.result)

// 3) استنى وشوف النتيجة
await new Promise((res) => setTimeout(res, 8000))
const nav = await post("/navigate", { url: "https://www.facebook.com/", wait_until: "domcontentloaded", timeout: 60_000, scroll_times: 1 })
const text = (nav.text ?? "").slice(0, 800)
console.log(`URL بعد الضغطة: ${nav.url}`)
console.log("--- الصفحة ---")
console.log(text.slice(0, 500))
