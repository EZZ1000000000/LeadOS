// LeadOS — فحص جميع مفاتيح dahl دفعة واحدة (نداء صغير لكل مفتاح)
// الناتج: قايمة المفاتيح الحية جاهزة للحقن في .env.local
const KEYS = [
  "dahl_Eya78yUQPAKzkCc3oex3SySP6id9juX1Q",
  "dahl_AZSUtyWEF7vs6hTk5r6pKq8P6rZPqC5kK",
  "dahl_5PK8yAUi8H6xRm8NNBCjZgVCFvUX2ucSg",
  "dahl_BWhTNxXvTsDTiSZ6C7xyGveTjNYK28ddv",
  "dahl_JA6WZuZXrR1AYzF94k8ZAn21UZ1iswRMB",
  "dahl_CHZxEjhCdJ92tgBKHY6ZjhabNt1tq1oEA",
  "dahl_6VJugT5MK4FxxzdMjpCSMwC8PqLXDouW4",
  "dahl_DiaKR3yaZ5Uniynsz7DaEEnMvqAVy2LS1",
  "dahl_8M4NTUAtV4W6a4ENznFUjzqigjUkPA8q3",
  "dahl_BzuuQLuBNE42nLbKu7F46Cf9eNkjhCQRi",
  "dahl_KyDXZmFiaZg8UuY1f4EjDxUzau6QEQ6FF",
]

const BASE = "https://inference.dahl.global/v1"

async function checkKey(key: string): Promise<{ ok: boolean; status: number; ms: number; note: string }> {
  const started = Date.now()
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "MiniMaxAI/MiniMax-M2.7",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(45_000),
    })
    const ms = Date.now() - started
    if (res.ok) return { ok: true, status: 200, ms, note: "LIVE" }
    const body = (await res.text()).slice(0, 80)
    return { ok: false, status: res.status, ms, note: body }
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - started, note: String(e).slice(0, 60) }
  }
}

async function main() {
  console.log(`فحص ${KEYS.length} مفتاح...`)
  const live: string[] = []
  for (let i = 0; i < KEYS.length; i++) {
    const key = KEYS[i]
    const r = await checkKey(key)
    const tag = key.slice(5, 15)
    if (r.ok) {
      live.push(key)
      console.log(`✅ #${i + 1} ${tag}... ${r.ms}ms`)
    } else {
      console.log(`❌ #${i + 1} ${tag}... ${r.status} — ${r.note}`)
    }
  }
  console.log(`\nالحية: ${live.length}/${KEYS.length}`)
  console.log("=== للحقن في .env.local ===")
  live.forEach((k, i) => console.log(`${i === 0 ? "DAHL_API_KEY" : `DAHL_API_KEY_${i + 1}`}=${k}`))
}

main()
