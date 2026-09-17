// probe.mjs — فحص JS حي في جلسة معينة: echo 'JS' | node scripts/probe.mjs [session]
const BASE = "http://127.0.0.1:9797"
const session = process.argv[2] || "fb"
async function call(path, body) {
  const r = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!j.ok) throw new Error(`${path}: ${JSON.stringify(j).slice(0, 300)}`)
  return j
}
const js = await new Promise((res) => {
  let d = ""
  process.stdin.on("data", (c) => (d += c))
  process.stdin.on("end", () => res(d))
})
const out = await call("/act", { session, action: "eval", script: js })
console.log(typeof out.result === "string" ? out.result : JSON.stringify(out.result, null, 1))
