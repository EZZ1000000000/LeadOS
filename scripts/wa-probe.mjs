// wa-probe.mjs — فحص حالة القائمة المفتوحة لمحدد الدولة في واتساب ويب
const BASE = "http://127.0.0.1:9797"
async function call(path, body) {
  const r = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!j.ok) throw new Error(`${path}: ${JSON.stringify(j).slice(0, 200)}`)
  return j
}
const js = await new Promise((res) => {
  let d = ""
  process.stdin.on("data", (c) => (d += c))
  process.stdin.on("end", () => res(d))
})
const out = await call("/act", { session: "wa", action: "eval", script: js })
console.log(JSON.stringify(out.result, null, 1).slice(0, 4000))
