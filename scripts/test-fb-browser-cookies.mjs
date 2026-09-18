// test-fb-browser-cookies.mjs — يفحص الكوكيز اللي شايفها فيسبوك جوة المتصفح الستيلث
const act = async (body) => {
  const r = await fetch("http://127.0.0.1:9797/act", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })
  return r.json().catch(() => ({}))
}

// الصفحة الحالية مفتوحة على facebook.com من الاختبار اللي فات
const r = await act({ session: "default", action: "eval", script: "document.cookie" })
console.log("document.cookie =", (r.result ?? JSON.stringify(r)).slice(0, 500))

// في كوكي httpOnly (xs, fr, datr) مش هتظهر في document.cookie — نجيبها من سياق المتصفح نفسه
const r2 = await act({
  session: "default",
  action: "eval",
  script: "(() => { const names = document.cookie.split(';').map(c=>c.trim().split('=')[0]); return JSON.stringify({visible: names, hasCUser: names.includes('c_user'), url: location.href}); })()",
})
console.log("تفصيل:", (r2.result ?? JSON.stringify(r2)).slice(0, 500))
