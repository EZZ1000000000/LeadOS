// test-fb-deep-debug.mjs — جرة الكوكيز كاملة + مراقبة الضغطة لحظة بلحظة
const post = async (endpoint, body, timeout = 150_000) => {
  const r = await fetch(`http://127.0.0.1:9797${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  })
  return r.json().catch(() => ({}))
}

// 1) الجرة كاملة (أسماء بس + هل xs موجود بقيمته)
const jar = await post("/act", {
  session: "default",
  action: "eval",
  script: `(() => {
    const cs = document.cookie.split(';').map(c => c.trim())
    const names = cs.map(c => c.split('=')[0])
    return JSON.stringify({ names, count: cs.length, xsLen: (cs.find(c => c.startsWith('xs=')) || '').length, cUser: (cs.find(c => c.startsWith('c_user=')) || '').slice(0, 30) })
  })()`,
})
console.log("الجرة (غير httpOnly):", jar.result)

// 2) اضغط متابعة وراقب الـURL كل ثانية 20 ثانية
const watch = await post("/act", {
  session: "default",
  action: "eval",
  script: `(async () => {
    const btn = Array.from(document.querySelectorAll('div[role="button"]')).find(b => (b.innerText || '').trim() === 'متابعة' && b.offsetParent !== null)
    if (!btn) return JSON.stringify({ err: 'NO_BTN' })
    const logs = []
    btn.click()
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000))
      logs.push(i + ':' + location.pathname.slice(0, 40) + '|' + document.body.innerText.slice(0, 60).replace(/\\n/g, ' '))
      if (/checkpoint|login\\//.test(location.href)) break
    }
    return JSON.stringify(logs, null, 0)
  })()`,
  timeout: 60_000,
})
console.log("مراقبة الضغطة:", (watch.result ?? JSON.stringify(watch)).slice(0, 1500))
