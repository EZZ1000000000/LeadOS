// test-fb-login-check.mjs — بعد الحقن الكامل: هل فيسبوك بيعتبرنا مسجلين؟
const post = async (endpoint, body, timeout = 150_000) => {
  const r = await fetch(`http://127.0.0.1:9797${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  })
  return r.json().catch(() => ({}))
}

const nav = await post("/navigate", { url: "https://www.facebook.com/", wait_until: "domcontentloaded", timeout: 60_000, scroll_times: 1 })
const url = nav.url ?? ""
const text = (nav.text ?? "").slice(0, 1200)

const loginWall = /login|checkpoint/i.test(url) || /تسجيل الدخول إلى فيسبوك|log in or sign up/i.test(text)
const loggedIn = !loginWall

console.log(`URL: ${url}`)
console.log(`الحالة: ${loggedIn ? "✓✓ مسجلين دخول — الجلسة حية!" : "✗ لسه جدار دخول"}`)
console.log("--- أول 400 حرف ---")
console.log(text.slice(0, 400))
