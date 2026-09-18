// test-fb-mbasic.mjs — تجربة mbasic و m — النسخ المبسطة بتقبل كوكيز الجلسة مباشرة
const post = async (endpoint, body, timeout = 150_000) => {
  const r = await fetch(`http://127.0.0.1:9797${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  })
  return r.json().catch(() => ({}))
}

for (const url of ["https://mbasic.facebook.com/", "https://m.facebook.com/"]) {
  const nav = await post("/navigate", { url, wait_until: "domcontentloaded", timeout: 60_000 })
  const text = (nav.text ?? "").slice(0, 350)
  const url2 = nav.url ?? ""
  const loggedIn = /تسجيل الخروج|Log Out|logout|الصفحة الرئيسية|الأحداث|search| Search/i.test(text) && !/تسجيل الدخول إلى فيسبوك/i.test(text)
  console.log(`\n=== ${url} → ${url2}`)
  console.log(loggedIn ? "✓ مسجلين" : "؟ غير مسجلين — الصفحة:")
  console.log(text.slice(0, 280).replace(/\n+/g, " | "))
}
