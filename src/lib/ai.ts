// LeadOS — AI Provider: NVIDIA NIM (المزود الوحيد للذكاء الاصطناعي)
// راوتر مهام: كل مهمة بتروح لمودلها المناسب، وكل مودل له سلسلة بدائل لو وقع/اتملى.
// السلاسل (مختارة بقياس حي على مهام عربية حقيقية — scripts/final-model-eval.py):
//   FAST   (تصنيف JSON): diffusiongemma-26b → llama-3.2-11b-vision → nemotron-3-super
//   MAIN   (محادثة/أيجنت/كتابة/بحث): nemotron-3-super-120b → nemotron-3-ultra-550b → gpt-oss-20b
//   REASON (تحليل عميق): deepseek-v4-flash → nemotron-3-nano-omni-reasoning → nemotron-3-super
// API متوافقة مع OpenAI — كل نداء بيتسجل في AiRun للمراقبة (doc §64).
import { db } from "@/lib/db"

const NIM_BASE = (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/$/, "")
const NIM_KEY = process.env.NVIDIA_API_KEY?.trim() || ""

export type AiTask = "classify" | "chat" | "compose" | "agent" | "research" | "reason"

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
  /** المهمة المطلوبة — بتحدد سلسلة المودلات (افتراضي: main) */
  task?: AiTask
}

export interface AiResult {
  text: string
  provider: string
  model: string
  latencyMs: number
  task?: AiTask
  inputTokens?: number
  outputTokens?: number
}

// ─── سلاسل المودلات لكل مهمة (الأول = الأفضل، الباقي بدائل تلقائية) ───
const TASK_CHAINS: Record<AiTask, "fast" | "main" | "reason"> = {
  classify: "fast",
  chat: "main",
  compose: "main",
  agent: "main",
  research: "main",
  reason: "reason",
}

const DEFAULT_CHAINS: Record<"fast" | "main" | "reason", string> = {
  fast: "google/diffusiongemma-26b-a4b-it,meta/llama-3.2-11b-vision-instruct,nvidia/nemotron-3-super-120b-a12b",
  main: "nvidia/nemotron-3-super-120b-a12b,nvidia/nemotron-3-ultra-550b-a55b,openai/gpt-oss-20b",
  reason: "deepseek-ai/deepseek-v4-flash-0731,nvidia/nemotron-3-nano-omni-30b-a3b-reasoning,nvidia/nemotron-3-super-120b-a12b",
}

function chainFor(kind: "fast" | "main" | "reason"): string[] {
  const envKey = kind === "fast" ? "NVIDIA_MODEL_FAST" : kind === "main" ? "NVIDIA_MODEL_MAIN" : "NVIDIA_MODEL_REASON"
  const raw = process.env[envKey]?.trim()
  const list = (raw && raw.length > 3 ? raw : DEFAULT_CHAINS[kind])
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean)
  return list.length ? list : [DEFAULT_CHAINS[kind].split(",")[0]]
}

// تبريد المودلات: 429 → دقيقة، 404/5xx → 10 دقايق، شبكة → 15 ثانية
const cooldownUntil = new Map<string, number>()
function noteFailure(model: string, status: number): void {
  const ms = status === 429 ? 60_000 : status === 404 || status >= 500 ? 600_000 : 15_000
  cooldownUntil.set(model, Date.now() + ms)
}

function modelsLive(kind: "fast" | "main" | "reason"): string[] {
  const now = Date.now()
  return chainFor(kind).filter((m) => (cooldownUntil.get(m) ?? 0) <= now)
}

async function callNvidia(model: string, messages: AiMessage[], opts: AiCallOptions, task: AiTask): Promise<AiResult | null> {
  const started = Date.now()
  try {
    const res = await fetch(`${NIM_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${NIM_KEY}` },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? (task === "reason" ? 2000 : 1600),
      }),
      signal: AbortSignal.timeout(task === "reason" ? 90_000 : 60_000),
    })
    if (!res.ok) {
      noteFailure(model, res.status)
      return null
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string; reasoning_content?: string }; finish_reason?: string }>
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }
    const choice = data.choices?.[0]
    const text = (choice?.message?.content ?? "").trim()
    // مودلات التفكير لو التوكنز خلصت وقت التفكير بترجع فاضية → تعتبر فشل وينتقل للبديل
    if (!text) {
      noteFailure(model, choice?.finish_reason === "length" ? 429 : 500)
      return null
    }
    return {
      text,
      provider: "NVIDIA",
      model,
      latencyMs: Date.now() - started,
      task,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    }
  } catch {
    noteFailure(model, 0)
    return null
  }
}

export async function aiChat(messages: AiMessage[], opts: AiCallOptions = {}): Promise<AiResult | null> {
  const task: AiTask = opts.task ?? "chat"
  const kind = TASK_CHAINS[task]
  if (!NIM_KEY) return null

  let result: AiResult | null = null
  for (const model of modelsLive(kind)) {
    result = await callNvidia(model, messages, opts, task)
    if (result) break
  }

  // Log AiRun للمراقبة (best-effort)
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
  const result = await aiChat(messages, { ...opts, task: opts.task ?? "classify" })
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
  const hasKey = Boolean(NIM_KEY)
  return {
    nvidia: hasKey && modelsLive("main").length > 0,
    hasKey,
    base: NIM_BASE,
    models: {
      fast: chainFor("fast")[0],
      main: chainFor("main")[0],
      reason: chainFor("reason")[0],
    },
    chains: {
      fast: chainFor("fast"),
      main: chainFor("main"),
      reason: chainFor("reason"),
    },
    cooling: [...cooldownUntil.entries()].filter(([, t]) => t > Date.now()).length,
    note: hasKey
      ? "NVIDIA NIM (مودلات مجانية) — راوتر مهام تلقائي"
      : "أضف NVIDIA_API_KEY في متغيرات البيئة — بدون مفتاح النظام يستخدم المحرك الاستدلالي للكلمات المفتاحية",
  }
}
