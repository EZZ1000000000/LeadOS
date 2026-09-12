// LeadOS — AI Provider Abstraction
// Priority: GEMINI (مجاني 1500 طلب/يوم) → GROQ (مجاني 14400/يوم) →
//           Mistral pool (25 مفتاح بدوران) → z-ai SDK → null (احتياطي heuristics)
// Gemini/Groq يتaktivان تلقائيًا بمجرد وجود GEMINI_API_KEY / GROQ_API_KEY في البيئة
// Every call is logged as an AiRun for cost tracking (doc §64).
import { db } from "@/lib/db"

export interface AiMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface AiCallOptions {
  workspaceId?: string
  runType?: string
  leadId?: string
  researchRunId?: string
  jobId?: string
  temperature?: number
  maxTokens?: number
}

export interface AiResult {
  text: string
  provider: string
  model: string
  latencyMs: number
  inputTokens?: number
  outputTokens?: number
}

let zaiInstance: unknown | null = null
let zaiInitPromise: Promise<unknown> | null = null

async function getZai(): Promise<{ chat: { completions: { create: (b: unknown) => Promise<Record<string, unknown>> } } }> {
  if (zaiInstance) return zaiInstance as never
  if (!zaiInitPromise) {
    const mod = await import("z-ai-web-dev-sdk")
    const ZAI = mod.default
    zaiInitPromise = (ZAI as { create: () => Promise<unknown> }).create()
  }
  zaiInstance = await zaiInitPromise
  return zaiInstance as never
}

// ---- Mistral key pool rotation (25+ keys ⇒ huge rate-limit ceiling) ----
let mistralKeys: string[] | null = null
let mistralCursor = 0
const mistralCooldownUntil = new Map<string, number>() // key → timestamp
const mistralBanned = new Set<string>()

function mistralKeyPool(): string[] {
  if (mistralKeys) return mistralKeys
  const pool = (process.env.MISTRAL_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length >= 20)
  const primary = process.env.MISTRAL_API_KEY?.trim()
  if (primary && primary.length >= 20 && !pool.includes(primary)) pool.unshift(primary)
  mistralKeys = pool
  return pool
}

function nextMistralKey(): string | null {
  const pool = mistralKeyPool().filter((k) => !mistralBanned.has(k))
  if (!pool.length) return null
  const now = Date.now()
  const fresh = pool.filter((k) => (mistralCooldownUntil.get(k) ?? 0) <= now)
  if (fresh.length) {
    const key = fresh[mistralCursor % fresh.length]
    mistralCursor++
    return key
  }
  // كل المفاتيح في تبريد — استخدم أقرب واحد هيتفرغ
  return pool.sort((a, b) => (mistralCooldownUntil.get(a) ?? 0) - (mistralCooldownUntil.get(b) ?? 0))[0]
}

function noteMistralFailure(key: string, status: number): void {
  if (status === 401 || status === 403) {
    mistralBanned.add(key) // مفتاح ميت — يُشال نهائيًا
  } else if (status === 429) {
    mistralCooldownUntil.set(key, Date.now() + 60_000) // دقيقة تبريد
  } else {
    mistralCooldownUntil.set(key, Date.now() + 10_000)
  }
}

// ---- OpenAI-compatible free providers (Gemini / Groq) ----
interface FreeProvider { name: string; baseUrl: string; model: string; maxPerDay: string }
const FREE_PROVIDERS: FreeProvider[] = [
  ...(process.env.GEMINI_API_KEY ? [{ name: "GEMINI", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: process.env.GEMINI_MODEL || "gemini-2.0-flash", maxPerDay: "1500/يوم مجاني" }] : []),
  ...(process.env.GROQ_API_KEY ? [{ name: "GROQ", baseUrl: "https://api.groq.com/openai/v1", model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile", maxPerDay: "14400/يوم مجاني" }] : []),
]
const freeCooldownUntil = new Map<string, number>() // provider → timestamp

async function callFreeProvider(p: FreeProvider, messages: AiMessage[], opts: AiCallOptions): Promise<AiResult | null> {
  const key = p.name === "GEMINI" ? process.env.GEMINI_API_KEY : process.env.GROQ_API_KEY
  if (!key) return null
  const cooldown = freeCooldownUntil.get(p.name) ?? 0
  if (cooldown > Date.now()) return null
  const started = Date.now()
  try {
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: p.model,
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 1600,
      }),
      signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) {
      // 429 = حصة/معدل — تبريد دقيقة وينتقل للتابع
      freeCooldownUntil.set(p.name, Date.now() + (res.status === 429 ? 60_000 : 10_000))
      return null
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }
    const text = data.choices?.[0]?.message?.content ?? ""
    if (!text) return null
    return { text, provider: p.name, model: p.model, latencyMs: Date.now() - started, inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens }
  } catch {
    freeCooldownUntil.set(p.name, Date.now() + 10_000)
    return null
  }
}

async function callMistral(messages: AiMessage[], opts: AiCallOptions): Promise<AiResult | null> {
  const pool = mistralKeyPool()
  if (!pool.length) return null
  const model = process.env.MISTRAL_MODEL || "mistral-small-latest"
  const attempts = Math.min(3, pool.length)
  for (let i = 0; i < attempts; i++) {
    const key = nextMistralKey()
    if (!key) return null
    const started = Date.now()
    try {
      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages,
          temperature: opts.temperature ?? 0.2,
          max_tokens: opts.maxTokens ?? 1600,
        }),
        signal: AbortSignal.timeout(45000),
      })
      if (!res.ok) {
        noteMistralFailure(key, res.status)
        continue // جرّب المفتاح اللي بعده فورًا
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>
        usage?: { prompt_tokens?: number; completion_tokens?: number }
      }
      const text = data.choices?.[0]?.message?.content ?? ""
      if (!text) {
        noteMistralFailure(key, 500)
        continue
      }
      return {
        text,
        provider: "MISTRAL",
        model,
        latencyMs: Date.now() - started,
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
      }
    } catch {
      noteMistralFailure(key, 0) // timeout/شبكة — تبريد قصير
    }
  }
  return null
}

async function callZai(messages: AiMessage[], opts: AiCallOptions): Promise<AiResult | null> {
  const started = Date.now()
  try {
    const zai = await getZai()
    const data = await zai.chat.completions.create({
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 1600,
      thinking: { type: "disabled" },
    })
    const content =
      (data as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content ?? ""
    if (!content) return null
    return {
      text: content,
      provider: "ZAI",
      model: "glm",
      latencyMs: Date.now() - started,
    }
  } catch {
    return null
  }
}

export async function aiChat(messages: AiMessage[], opts: AiCallOptions = {}): Promise<AiResult | null> {
  let result: AiResult | null = null
  for (const p of FREE_PROVIDERS) {
    result = await callFreeProvider(p, messages, opts)
    if (result) break
  }
  if (!result) result = await callMistral(messages, opts)
  if (!result) result = await callZai(messages, opts)
  // Log AiRun for observability/cost tracking (best-effort)
  if (result && opts.workspaceId) {
    void db.aiRun
      .create({
        data: {
          workspaceId: opts.workspaceId,
          type: (opts.runType || "OTHER") as never,
          provider: result.provider as never,
          model: result.model,
          leadId: opts.leadId,
          researchRunId: opts.researchRunId,
          jobId: opts.jobId,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          totalTokens: (result.inputTokens ?? 0) + (result.outputTokens ?? 0),
          latencyMs: result.latencyMs,
          success: true,
        },
      })
      .catch(() => undefined)
  }
  return result
}

/** Chat expecting a JSON object back; extracts the first balanced JSON object. */
export async function aiChatJson<T>(messages: AiMessage[], opts: AiCallOptions = {}): Promise<T | null> {
  const result = await aiChat(messages, opts)
  if (!result) return null
  return extractJson<T>(result.text)
}

export function extractJson<T>(text: string): T | null {
  const start = text.indexOf("{")
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape) { escape = false; continue }
    if (ch === "\\") { escape = true; continue }
    if (ch === '"') inString = !inString
    if (inString) continue
    if (ch === "{") depth++
    if (ch === "}") {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1)) as T
        } catch {
          return null
        }
      }
    }
  }
  return null
}

export function aiProviderStatus() {
  const now = Date.now()
  return {
    gemini: Boolean(process.env.GEMINI_API_KEY) && (freeCooldownUntil.get("GEMINI") ?? 0) <= now,
    groq: Boolean(process.env.GROQ_API_KEY) && (freeCooldownUntil.get("GROQ") ?? 0) <= now,
    mistral: mistralKeyPool().length > 0,
    keys: mistralKeyPool().filter((k) => !mistralBanned.has(k)).length,
    banned: mistralBanned.size,
    fallback: "z-ai",
  }
}
