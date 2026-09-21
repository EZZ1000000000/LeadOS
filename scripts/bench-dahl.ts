// LeadOS — قياس حي لمودلات dahl (GLM-5.3-Flash / DeepSeek-V4-Flash / MiniMax-M2.7)
// الهدف: توزيع مهام الراوتر على أساس قياسات حقيقية (سرعة + عربي + JSON)
const BASE = "https://inference.dahl.global/v1"
const KEY = process.env.DAHL_API_KEY || ""

const MODELS = ["zai-org/GLM-5.3-Flash", "deepseek-ai/DeepSeek-V4-Flash-0731", "MiniMaxAI/MiniMax-M2.7"]

interface Trial { model: string; task: string; ms: number; ok: boolean; note: string }

function stripThink(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*$/gi, "").trim()
}

async function call(model: string, messages: unknown[], maxTokens: number, timeoutMs = 90_000) {
  const started = Date.now()
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.2 }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const ms = Date.now() - started
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      return { ms, ok: false, text: "", err: `${res.status} ${body.slice(0, 120)}` }
    }
    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content ?? ""
    const text = stripThink(raw)
    const thinkLen = raw.length - text.length
    return { ms, ok: !!text, text, err: "", thinkLen }
  } catch (e) {
    return { ms: Date.now() - started, ok: false, text: "", err: String(e).slice(0, 120) }
  }
}

async function main() {
  const trials: Trial[] = []
  // مهمة 1: JSON تصنيف صارم (عربي مصري)
  const jsonMsg = [
    { role: "system", content: "أنت مصنف صارم. رد بـ JSON فقط بدون أي كلام إضافي." },
    { role: "user", content: 'صنف البوست دي: {"intent":"buy_now|researching|noise","domain":"string","urgency":"high|medium|low"}\n\nالبوست: "بجد تعبت من نظام الكاشير بتاعي بيهد كل يوم جميل، محتاج نظام POS جديد للمطعم ضروري الشهر ده، مين يرشحلي؟"' },
  ]
  // مهمة 2: صياغة رد بيعي مصري
  const composeMsg = [
    { role: "system", content: "أنت زيزو — وكيل مبيعات مصري بيتكلم عامية مصرية ودود وواثق. ممنوع فصحى." },
    { role: "user", content: "اكتب رد واتساب قصير (سطرين) لصاحب مطعم شاف إعلاننا وقال «بكام نظام الكاشير؟»" },
  ]

  for (const model of MODELS) {
    const j = await call(model, jsonMsg, 300)
    trials.push({ model, task: "json-classify", ms: j.ms, ok: j.ok, note: j.ok ? `valid=${/^\\s*\\{/.test(j.text) ? "yes" : "partial"}` : j.err })
    if (j.ok) console.log(`[${model}] JSON (${j.ms}ms):`, j.text.slice(0, 150).replace(/\\n/g, " "))
    const c = await call(model, composeMsg, 400)
    trials.push({ model, task: "compose-egy", ms: c.ms, ok: c.ok, note: c.ok ? "ok" : c.err })
    if (c.ok) console.log(`[${model}] COMPOSE (${c.ms}ms):`, c.text.slice(0, 150).replace(/\\n/g, " "))
  }
  console.log("\\n=== ملخص ===")
  for (const t of trials) console.log(`${t.model.padEnd(34)} ${t.task.padEnd(14)} ${t.ok ? "OK " : "FAIL"} ${t.ms}ms  ${t.note}`)
}

main()
