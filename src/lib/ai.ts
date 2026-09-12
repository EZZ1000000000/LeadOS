// LeadOS — AI Provider Abstraction
// Priority: Mistral API (key pool with rotation: MISTRAL_API_KEYS + MISTRAL_API_KEY)
//           → z-ai SDK (sandbox default) → null (caller falls back to heuristics)
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
  let result = await callMistral(messages, opts)
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

export function aiProviderStatus(): { mistral: boolean; keys: number; banned: number; fallback: string } {
  return {
    mistral: mistralKeyPool().length > 0,
    keys: mistralKeyPool().filter((k) => !mistralBanned.has(k)).length,
    banned: mistralBanned.size,
    fallback: "z-ai",
  }
}
