// LeadOS — AI Provider Router: dahl (أساسي) → NVIDIA NIM → z-ai (طوارئ)
// راوتر مهام دقيق: كل مهمة ليها موديلها الأمثل + سلسلة بدائل تلقائية لو وقع/اتملى.
// مزود dahl (inference.dahl.global — متوافق OpenAI): GLM-5.3-Flash + DeepSeek-V4-Flash + MiniMax-M2.7
//   الكتالوج مبني على قياس حي: scripts/bench-dahl.ts (JSON/صياغة/عربي مصري)
//   MiniMax بيرجع <think> في المحتوى → بيتنضف قبل الرجوع، وGLM بيضرب model_concurrency ساعات الذروة → تبريد تلقائي.
// كتالوج NVIDIA مبني على مسح حي كامل (82 موديل → 19 شغال): scripts/nvidia-full-scan.py
// مجمعات مفاتيح: DAHL_API_KEY(_N) و NVIDIA_API_KEY(_N) — توزيع دائري وتبديل فوري عند 429/401/403.
// كل نداء بيتسجل في AiRun للمراقبة (doc §64).
import { db } from "@/lib/db"

const NIM_BASE = (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/$/, "")

// ─── مزود dahl (أساسي — OpenAI-compatible) ───
const DAHL_BASE = (process.env.DAHL_BASE_URL || "https://inference.dahl.global/v1").replace(/\/$/, "")
const DAHL_KEY_POOL: string[] = Object.entries(process.env)
  .filter(([k, v]) => /^DAHL_API_KEY(_\d+)?$/.test(k) && v && v.trim().length > 20)
  .map(([, v]) => (v as string).trim())

// تبريد مودلات dahl نفس منطق NVIDIA (المؤشر منفصل عشان الأسماء مختلفة)
const dahlCooldownUntil = new Map<string, number>()
function noteDahlFailure(model: string, status: number): void {
  const ms = status === 429 ? 60_000 : status === 404 || status >= 500 ? 600_000 : 15_000
  dahlCooldownUntil.set(model, Date.now() + ms)
}

// ─── مجمع مفاتيح dahl: توزيع دائري + تبديل تلقائي عند الضغط ───
// • النداءات بالتبادل على المفاتيح عشان الحمل يتوزع (11 مفتاح = سعة أكبر بكتير)
// • 429 (موديل مضغوط/مفتاح مضغوط) → المفتاح التالي على نفس الموديل فورًا
// • 401/403 → المفتاح ميت ويُشال من التداول نهائيًا
const dahlKeyCooldownUntil = new Map<string, number>()
const deadDahlKeys = new Set<string>()
let dahlKeyCursor = 0

function noteDahlKeyFailure(key: string, status: number): void {
  if (status === 401 || status === 403) deadDahlKeys.add(key)
  else if (status === 429) dahlKeyCooldownUntil.set(key, Date.now() + 60_000)
}

function pickDahlKeys(): string[] {
  const now = Date.now()
  const alive = DAHL_KEY_POOL.filter((k) => !deadDahlKeys.has(k))
  const live = alive.filter((k) => (dahlKeyCooldownUntil.get(k) ?? 0) <= now)
  const pool = live.length ? live : alive.slice(0, 1)
  if (!pool.length) return []
  dahlKeyCursor = (dahlKeyCursor + 1) % pool.length
  return [...pool.slice(dahlKeyCursor), ...pool.slice(0, dahlKeyCursor)]
}

/** حالة مجمع مفاتيح dahl للمراقبة */
export function dahlKeyPoolStatus() {
  const now = Date.now()
  return {
    total: DAHL_KEY_POOL.length,
    live: DAHL_KEY_POOL.filter((k) => !deadDahlKeys.has(k) && (dahlKeyCooldownUntil.get(k) ?? 0) <= now).length,
    dead: deadDahlKeys.size,
    cooling: [...dahlKeyCooldownUntil.values()].filter((t) => t > now).length,
  }
}

function dahlModelsLive(chain: string[]): string[] {
  const now = Date.now()
  const live = chain.filter((m) => (dahlCooldownUntil.get(m) ?? 0) <= now)
  return live.length ? live : [chain[0]]
}

/** تنظيف بلوكات التفكير <think>...</think> اللي بترجع مدمجة في المحتوى (MiniMax/DeepSeek) */
function stripThink(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .trim()
}

/** هل الرسايل فيها أجزاء صور؟ (مودلات dahl نصية فقط) */
function hasImageParts(messages: AiMessage[]): boolean {
  return messages.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type === "image_url"))
}

// ─── مجمع المفاتيح: تبديل تلقائي عند الـrate-limit ───
// • توزيع دائري: النداءات بالتبادل على المفاتيح عشان الحمل يتوزع والحصص تكتمل أبطأ
// • 429 → المفتاح يتبرّد دقيقة والنداء بيكمل فورًا بالمفتاح التالي على نفس الموديل
// • 401/403 → المفتاح ميت ويُشال من التداول نهائيًا
const KEY_POOL: string[] = Object.entries(process.env)
  .filter(([k, v]) => /^NVIDIA_API_KEY(_\d+)?$/.test(k) && v && v.trim().length > 20)
  .map(([, v]) => (v as string).trim())

const keyCooldownUntil = new Map<string, number>()
const deadKeys = new Set<string>()
let keyCursor = 0

function noteKeyFailure(key: string, status: number): void {
  if (status === 401 || status === 403) deadKeys.add(key)
  else if (status === 429) keyCooldownUntil.set(key, Date.now() + 60_000)
}

/** المفاتيح الحية بدءًا من المؤشر الدوار (توزيع حمل) — لو كلها مبردة بيجرّب الأول على أي حال */
function pickKeys(): string[] {
  const now = Date.now()
  const alive = KEY_POOL.filter((k) => !deadKeys.has(k))
  const live = alive.filter((k) => (keyCooldownUntil.get(k) ?? 0) <= now)
  const pool = live.length ? live : alive.slice(0, 1)
  if (!pool.length) return []
  keyCursor = (keyCursor + 1) % pool.length
  return [...pool.slice(keyCursor), ...pool.slice(0, keyCursor)]
}

/** حالة مجمع المفاتيح للمراقبة (واجهة الإعدادات) */
export function keyPoolStatus() {
  const now = Date.now()
  return {
    total: KEY_POOL.length,
    live: KEY_POOL.filter((k) => !deadKeys.has(k) && (keyCooldownUntil.get(k) ?? 0) <= now).length,
    dead: deadKeys.size,
    cooling: [...keyCooldownUntil.values()].filter((t) => t > now).length,
  }
}

/** خطاف اختبار داخلي (للسكريبتات فقط): محاكاة ضغط مفتاح والتحقق من التبديل */
export const _keyPoolTest = {
  keys: () => [...KEY_POOL],
  pick: () => [...pickKeys()],
  cool: (i: number, ms = 60_000) => keyCooldownUntil.set(KEY_POOL[i], Date.now() + ms),
  kill: (i: number) => deadKeys.add(KEY_POOL[i]),
  reset: () => { keyCooldownUntil.clear(); deadKeys.clear() },
}

// ─── المهام التشغيلية (كل مهمة = سلسلة موديلات مرتبة بالأفضل أولًا) ───
export type AiTask =
  | "classify"   // تصنيف بوستات/ليدز JSON سريع
  | "qualify"    // تقييم وتأهيل ليد (حكم تجاري)
  | "chat"       // محادثة AI Commander
  | "agent"      // حلقة أدوات الأيجنت (tool-calling)
  | "compose"    // صياغة ردود بيع/رسائل واتساب/إيميلات
  | "creative"   // محتوى إبداعي/بوستات/حملات
  | "research"   // بحث عميق/تحليل سوق (خلفي يتحمل البطء)
  | "reason"     // استدلال عميق/قرارات معقدة
  | "vision"     // تحليل صور/سكرين شوت
  | "translate"  // ترجمة
  | "summarize"  // تلخيص محتوى/مقالات
  | "code"       // توليد/إصلاح كود تكاملات
  | "moderate"   // فحص سلامة المحتوى قبل الإرسال

export const AI_TASK_LABELS: Record<AiTask, string> = {
  classify: "تصنيف سريع (JSON)",
  qualify: "تأهيل الليدز",
  chat: "محادثة القائد",
  agent: "أدوات الأيجنت",
  compose: "صياغة رسائل",
  creative: "محتوى إبداعي",
  research: "بحث عميق",
  reason: "استدلال عميق",
  vision: "تحليل صور",
  translate: "ترجمة",
  summarize: "تلخيص",
  code: "كود وتكاملات",
  moderate: "فحص السلامة",
}

export interface AiContentPart {
  type: "text" | "image_url"
  text?: string
  image_url?: { url: string }
}

export interface AiMessage {
  role: "system" | "user" | "assistant"
  content: string | AiContentPart[]
}

export interface AiCallOptions {
  workspaceId?: string
  runType?: string
  leadId?: string
  researchRunId?: string
  jobId?: string
  temperature?: number
  maxTokens?: number
  /** المهمة المطلوبة — بتحدد سلسلة الموديلات (افتراضي: chat) */
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

// ─── الكتالوج الحي (ممسوح فعليًا من الـAPI — كل موديل شغال له دور) ───
export interface CatalogEntry {
  id: string
  role: string
  kind: "general" | "reasoning" | "vision" | "creative" | "code" | "translate" | "safety" | "parse" | "embed" | "experimental"
  latency: string
  tasks: string[]
}

// ─── كتالوج dahl الحي (قياس حي: scripts/bench-dahl.ts) ───
export const DAHL_CATALOG: CatalogEntry[] = [
  { id: "deepseek-ai/DeepSeek-V4-Flash-0731", role: "المحرك الأساسي — عربي مصري طبيعي + استدلال عميق", kind: "reasoning", latency: "سريع (1.7s صياغة / 6.5s JSON)", tasks: ["compose", "research", "reason", "qualify", "agent", "code", "chat"] },
  { id: "MiniMaxAI/MiniMax-M2.7", role: "بطل التصنيف — JSON سريع 2s + تلخيص", kind: "parse", latency: "سريع (2s JSON / 18s صياغة)", tasks: ["classify", "summarize", "creative", "translate", "moderate"] },
  { id: "zai-org/GLM-5.3-Flash", role: "احتياط محادثة — مزدحم ساعات الذروة (model_concurrency → تبريد دقيقة)", kind: "general", latency: "متغير حسب الحمولة", tasks: ["chat"] },
]

// سلاسل dahl — الأفضل المقاس أولًا (vision: مفيش — المودلات نصية فقط)
const DAHL_TASK_CHAINS: Partial<Record<AiTask, string[]>> = {
  classify: ["MiniMaxAI/MiniMax-M2.7", "deepseek-ai/DeepSeek-V4-Flash-0731", "zai-org/GLM-5.3-Flash"],
  qualify: ["deepseek-ai/DeepSeek-V4-Flash-0731", "MiniMaxAI/MiniMax-M2.7"],
  chat: ["deepseek-ai/DeepSeek-V4-Flash-0731", "MiniMaxAI/MiniMax-M2.7", "zai-org/GLM-5.3-Flash"],
  agent: ["deepseek-ai/DeepSeek-V4-Flash-0731", "MiniMaxAI/MiniMax-M2.7"],
  compose: ["deepseek-ai/DeepSeek-V4-Flash-0731", "MiniMaxAI/MiniMax-M2.7"],
  creative: ["MiniMaxAI/MiniMax-M2.7", "deepseek-ai/DeepSeek-V4-Flash-0731"],
  research: ["deepseek-ai/DeepSeek-V4-Flash-0731", "MiniMaxAI/MiniMax-M2.7"],
  reason: ["deepseek-ai/DeepSeek-V4-Flash-0731", "MiniMaxAI/MiniMax-M2.7"],
  translate: ["MiniMaxAI/MiniMax-M2.7", "deepseek-ai/DeepSeek-V4-Flash-0731"],
  summarize: ["MiniMaxAI/MiniMax-M2.7", "deepseek-ai/DeepSeek-V4-Flash-0731"],
  code: ["deepseek-ai/DeepSeek-V4-Flash-0731", "MiniMaxAI/MiniMax-M2.7"],
  moderate: ["MiniMaxAI/MiniMax-M2.7", "deepseek-ai/DeepSeek-V4-Flash-0731"],
}

export const NVIDIA_CATALOG: CatalogEntry[] = [
  { id: "nvidia/nemotron-3-ultra-550b-a55b", role: "العقل المدبّر — أقوى موديل (550B MoE)", kind: "reasoning", latency: "فوري (616ms)", tasks: ["agent", "reason", "research", "chat"] },
  { id: "nvidia/nemotron-3-super-120b-a12b", role: "الأساسي — محادثة وكتابة عربية احترافية", kind: "general", latency: "سريع (6s)", tasks: ["chat", "compose", "qualify", "classify", "research", "translate"] },
  { id: "openai/gpt-oss-20b", role: "متعدد المهام — reasoning + JSON + أدوات", kind: "reasoning", latency: "سريع (2.3s)", tasks: ["classify", "qualify", "summarize", "code", "agent", "chat", "compose"] },
  { id: "google/diffusiongemma-26b-a4b-it", role: "بطل التصنيف — JSON عربي صارم 100%", kind: "general", latency: "سريع (5s)", tasks: ["classify", "summarize"] },
  { id: "deepseek-ai/deepseek-v4-flash-0731", role: "المحلل العميق — عربي مصري طبيعي + تفكير منفصل", kind: "reasoning", latency: "متوسط (14s)", tasks: ["research", "reason", "qualify", "compose", "code", "agent"] },
  { id: "meta/llama-3.2-11b-vision-instruct", role: "عين الأيجنت — تحليل صور وسكرين شوت", kind: "vision", latency: "فوري (940ms)", tasks: ["vision"] },
  { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", role: "رؤية + استدلال — بديل بصري شامل (omni)", kind: "vision", latency: "سريع (2.5s)", tasks: ["vision", "reason", "classify"] },
  { id: "z-ai/glm-5.3-flash", role: "محادثة بديل — Flash سريع نسبيًا", kind: "general", latency: "متوسط (13s)", tasks: ["chat", "summarize", "agent"] },
  { id: "nvidia/nemotron-3.5-lightning-30b-a3b", role: "احتياط عام — Lightning خفيف", kind: "general", latency: "متوسط (16s)", tasks: [] },
  { id: "meta/muse-glimmer-30b", role: "الكاتب الإبداعي — محتوى تسويقي وحملات", kind: "creative", latency: "متوسط (27s)", tasks: ["creative"] },
  { id: "mistralai/mistral-nemotron", role: "احتياط إبداعي/عام", kind: "general", latency: "متوسط (25s)", tasks: ["creative"] },
  { id: "poolside/laguna-xs-2.1", role: "متخصص كود — بديل برمجي", kind: "code", latency: "بطيء (61s)", tasks: ["code"] },
  { id: "google/gemma-4-31b-it", role: "طوارئ خلفية — معالجة بحثية تتحمل 2 دقيقة", kind: "general", latency: "خلفي (123s)", tasks: ["research"] },
  { id: "nvidia/riva-translate-4b-instruct-v2", role: "الترجمة الأساسية", kind: "translate", latency: "فوري (768ms)", tasks: ["translate"] },
  { id: "nvidia/riva-translate-4b-instruct-v1.1", role: "ترجمة بديلة", kind: "translate", latency: "فوري (491ms)", tasks: ["translate"] },
  { id: "nvidia/nemotron-3.5-content-safety", role: "حارس المحتوى — فحص سلامة قبل الإرسال", kind: "safety", latency: "فوري (425ms)", tasks: ["moderate"] },
  { id: "nvidia/llama-3.1-nemoguard-8b-content-safety", role: "حارس محتوى بديل", kind: "safety", latency: "متوسط (24s)", tasks: ["moderate"] },
  { id: "nvidia/nemotron-parse-2.0", role: "محلل مستندات — غير مستقر في الـAPI المجاني (500) — محجوز", kind: "experimental", latency: "فوري (573ms)", tasks: [] },
  { id: "nvidia/ising-calibration-1.5-31b", role: "تجريبي بحثي — محجوز عن الإنتاج عمدًا", kind: "experimental", latency: "بطيء (36s)", tasks: [] },
]

// ─── سلاسل المهام (الأول = الأمثل، الباقي بدائل تلقائية عند فشل/تبريد) ───
const DEFAULT_TASK_CHAINS: Record<AiTask, string[]> = {
  classify: ["google/diffusiongemma-26b-a4b-it", "openai/gpt-oss-20b", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", "nvidia/nemotron-3-super-120b-a12b"],
  qualify: ["nvidia/nemotron-3-super-120b-a12b", "openai/gpt-oss-20b", "deepseek-ai/deepseek-v4-flash-0731"],
  chat: ["nvidia/nemotron-3-super-120b-a12b", "z-ai/glm-5.3-flash", "openai/gpt-oss-20b", "nvidia/nemotron-3-ultra-550b-a55b"],
  agent: ["nvidia/nemotron-3-ultra-550b-a55b", "openai/gpt-oss-20b", "deepseek-ai/deepseek-v4-flash-0731", "z-ai/glm-5.3-flash"],
  compose: ["nvidia/nemotron-3-super-120b-a12b", "deepseek-ai/deepseek-v4-flash-0731", "openai/gpt-oss-20b"],
  creative: ["meta/muse-glimmer-30b", "nvidia/nemotron-3-super-120b-a12b", "mistralai/mistral-nemotron"],
  research: ["deepseek-ai/deepseek-v4-flash-0731", "nvidia/nemotron-3-ultra-550b-a55b", "nvidia/nemotron-3-super-120b-a12b", "google/gemma-4-31b-it"],
  reason: ["nvidia/nemotron-3-ultra-550b-a55b", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", "deepseek-ai/deepseek-v4-flash-0731"],
  vision: ["meta/llama-3.2-11b-vision-instruct", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"],
  translate: ["nvidia/riva-translate-4b-instruct-v2", "nvidia/riva-translate-4b-instruct-v1.1", "nvidia/nemotron-3-super-120b-a12b"],
  summarize: ["openai/gpt-oss-20b", "z-ai/glm-5.3-flash", "google/diffusiongemma-26b-a4b-it"],
  code: ["openai/gpt-oss-20b", "poolside/laguna-xs-2.1", "deepseek-ai/deepseek-v4-flash-0731"],
  moderate: ["nvidia/nemotron-3.5-content-safety", "nvidia/llama-3.1-nemoguard-8b-content-safety"],
}

// موديلات الإيمبدنج (نقطة نهاية مختلفة) — للبحث الدلالي في ذاكرة الأيجنت
const EMBED_CHAIN = ["nvidia/nemotron-3-embed-1b", "nvidia/llama-nemotron-embed-vl-1b-v2"]

// مهلة ومخرجات افتراضية لكل مهمة (مضبوطة على قياسات المسح الحي)
const TASK_TIMEOUT_MS: Record<AiTask, number> = {
  classify: 45_000, qualify: 60_000, chat: 60_000, agent: 90_000,
  compose: 90_000, creative: 120_000, research: 150_000, reason: 150_000,
  vision: 120_000, translate: 30_000, summarize: 60_000, code: 120_000,
  moderate: 25_000,
}
const TASK_MAX_TOKENS: Record<AiTask, number> = {
  classify: 250, qualify: 700, chat: 1000, agent: 1200, compose: 900,
  creative: 1400, research: 2200, reason: 2400, vision: 600, translate: 1200,
  summarize: 900, code: 1600, moderate: 120,
}

/** سلسلة مهمة — بتتفصل من env لو موجود (NVIDIA_MODEL_CLASSIFY=...) مع توافق أسماء قديمة */
export function chainFor(task: AiTask): string[] {
  const envKey = `NVIDIA_MODEL_${task.toUpperCase()}`
  const legacyKey = task === "classify" ? "NVIDIA_MODEL_FAST" : task === "chat" ? "NVIDIA_MODEL_MAIN" : task === "reason" ? "NVIDIA_MODEL_REASON" : ""
  const raw = process.env[envKey]?.trim() || (legacyKey ? process.env[legacyKey]?.trim() : "")
  const list = (raw && raw.length > 3 ? raw : DEFAULT_TASK_CHAINS[task].join(","))
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean)
  return list.length ? list : DEFAULT_TASK_CHAINS[task]
}

// تبريد المودلات: 429 → دقيقة، 404/5xx → 10 دقايق، شبكة → 15 ثانية
const cooldownUntil = new Map<string, number>()
function noteFailure(model: string, status: number): void {
  const ms = status === 429 ? 60_000 : status === 404 || status >= 500 ? 600_000 : 15_000
  cooldownUntil.set(model, Date.now() + ms)
}

function modelsLive(chain: string[]): string[] {
  const now = Date.now()
  const live = chain.filter((m) => (cooldownUntil.get(m) ?? 0) <= now)
  return live.length ? live : [chain[0]] // كل السلسلة مبردة → جرب الأمثل على أي حال
}

type CallOutcome =
  | { ok: true; result: AiResult }
  | { ok: false; status: number } // 0=شبكة، 429=rate، 401/403=مفتاح ميت، الباقي مشكلة موديل/نص فاضي

async function callNvidia(model: string, messages: AiMessage[], opts: AiCallOptions, task: AiTask, key: string): Promise<CallOutcome> {
  const started = Date.now()
  try {
    const res = await fetch(`${NIM_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? (task === "classify" || task === "moderate" ? 0.1 : 0.2),
        max_tokens: opts.maxTokens ?? TASK_MAX_TOKENS[task],
      }),
      signal: AbortSignal.timeout(TASK_TIMEOUT_MS[task]),
    })
    if (!res.ok) {
      // الـ429 يتفصل في الحلقة (مفتاح مضغوط ولا الموديل نفسه؟) — الباقي برّد موديل مباشر
      if (res.status !== 429) noteFailure(model, res.status)
      noteKeyFailure(key, res.status)
      return { ok: false, status: res.status }
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string; reasoning_content?: string }; finish_reason?: string }>
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }
    const choice = data.choices?.[0]
    const text = (choice?.message?.content ?? "").trim()
    // مودلات التفكير لو التوكنز خلصت وقت التفكير بترجع فاضية → مشكلة موديل (مش مفتاح)
    if (!text) {
      noteFailure(model, choice?.finish_reason === "length" ? 429 : 500)
      return { ok: false, status: 500 }
    }
    const result: AiResult = {
      text,
      provider: "NVIDIA",
      model,
      latencyMs: Date.now() - started,
      task,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    }
    return { ok: true, result }
  } catch {
    noteFailure(model, 0)
    return { ok: false, status: 0 }
  }
}

async function callDahl(model: string, messages: AiMessage[], opts: AiCallOptions, task: AiTask, key: string): Promise<CallOutcome> {
  const started = Date.now()
  try {
    const res = await fetch(`${DAHL_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? (task === "classify" || task === "moderate" ? 0.1 : 0.2),
        // مودلات dahl تفكيرية (<think> بياكل من الميزانية) — حد أدنى 1000 توكن يضمن نزول الرد
        max_tokens: Math.max(opts.maxTokens ?? TASK_MAX_TOKENS[task], 1000),
      }),
      signal: AbortSignal.timeout(TASK_TIMEOUT_MS[task]),
    })
    if (!res.ok) {
      // dahl بيرجع {"error":{"code":"model_concurrency"}} بنفس معنى 429 — التبريد الموحد بيكفي
      if (res.status !== 429) noteDahlFailure(model, res.status)
      noteDahlKeyFailure(key, res.status)
      return { ok: false, status: res.status }
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }
    const choice = data.choices?.[0]
    const text = stripThink(choice?.message?.content ?? "")
    // مودلات التفكير لو التوكنز خلصت وقت التفكير بترجع فاضية → برّد الموديل وجرب التالي
    if (!text) {
      noteDahlFailure(model, choice?.finish_reason === "length" ? 429 : 500)
      return { ok: false, status: 500 }
    }
    const result: AiResult = {
      text,
      provider: "DAHL",
      model,
      latencyMs: Date.now() - started,
      task,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    }
    return { ok: true, result }
  } catch {
    noteDahlFailure(model, 0)
    return { ok: false, status: 0 }
  }
}

async function logRun(result: AiResult, opts: AiCallOptions, success: boolean, error?: string): Promise<void> {
  if (!opts.workspaceId) return
  try {
    await db.aiRun.create({
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
        success,
        errorMessage: error,
      },
    })
  } catch {
    // تسجيل best-effort
  }
}

/** سلسلة dahl كاملة: موديل → مفاتيح → أول نجاح أو null
 * بدون لابل (مفكك SWC بيحوّل اللوب المليبل لبلوك وcontinue على بلوك بيتكسر) */
async function callDahlChain(chain: string[], messages: AiMessage[], opts: AiCallOptions, task: AiTask): Promise<AiResult | null> {
  for (const model of dahlModelsLive(chain)) {
    const keys = pickDahlKeys()
    for (const key of keys) {
      const out = await callDahl(model, messages, opts, task, key)
      if (out.ok) return out.result
      if (out.status === 401 || out.status === 403) continue // مفتاح ميت → المفتاح التالي
      // سعة الموديل نفسه مضغوطة (model_concurrency) أو خطأ شبكة/موديل
      // → برّد الموديل عند 429 وانتقل للموديل التالي (المفاتيح تفضل حية للباقي)
      if (out.status === 429) noteDahlFailure(model, 429)
      break
    }
  }
  return null
}

export async function aiChat(messages: AiMessage[], opts: AiCallOptions = {}): Promise<AiResult | null> {
  const task: AiTask = opts.task ?? "chat"
  let result: AiResult | null = null

  // الطبقة 1: dahl (المزود الأساسي — مجمع مفاتيح المستخدم) — بيتجنب لو الرسايل فيها صور
  if (DAHL_KEY_POOL.length && !hasImageParts(messages)) {
    result = await callDahlChain(DAHL_TASK_CHAINS[task] ?? [], messages, opts, task)
  }

  // الطبقة 2: NVIDIA NIM (لو فيه مفاتيح)
  if (!result && KEY_POOL.length) {
    outer: for (const model of modelsLive(chainFor(task))) {
      const keys = pickKeys()
      let rateLimitedAll = true
      for (const key of keys) {
        const out = await callNvidia(model, messages, opts, task, key)
        if (out.ok) {
          result = out.result
          break outer
        }
        // مشكلة مفتاح (rate/ميت)؟ → المفتاح التالي على نفس الموديل فورًا
        if (out.status === 429 || out.status === 401 || out.status === 403) continue
        rateLimitedAll = false
        break // مشكلة موديل/شبكة → الموديل التالي
      }
      // كل المفاتيح ضربت rate-limit على الموديل ده → برّده دقيقة عشان النداء الجاي يبدأ بموديل تاني
      if (rateLimitedAll) noteFailure(model, 429)
    }
  }

  // الطبقة 3: محرك z-ai (شغال بدون مفتاح — بيضمن زيزو مش بيصمت أبداً)
  if (!result) result = await zaiChat(messages, task)

  if (result) void logRun(result, opts, true)
  else void logRun(
    { text: "", provider: "OTHER", model: "none", latencyMs: 0, task },
    opts,
    false,
    "all-providers-failed (dahl+nvidia+zai)",
  )
  return result
}

// ─── محرك z-ai (SDK محلي — fallback بدون مفاتيح خارجية) ───
let zaiSingleton: { chat: { completions: { create: (args: unknown) => Promise<{ choices?: Array<{ message?: { content?: string } }> }> } } } | null = null
async function zaiChat(messages: AiMessage[], task: AiTask): Promise<AiResult | null> {
  try {
    if (!zaiSingleton) {
      const mod = (await import("z-ai-web-dev-sdk")) as unknown as { default?: { create: () => Promise<unknown> }; create?: () => Promise<unknown> }
      const Z = (mod.default ?? mod) as { create: () => Promise<unknown> }
      zaiSingleton = (await Z.create()) as never
    }
    // ملاحظة: ز-ai بيستخدم role=assistant للبرومبت النظامي (حسب توثيقه الرسمي)
    const mapped = messages.map((m) => ({
      role: m.role === "system" ? "assistant" : m.role,
      content: typeof m.content === "string" ? m.content : m.content.map((p: { text?: string }) => p?.text ?? "").join(" "),
    }))
    const started = Date.now()
    const completion = await zaiSingleton.chat.completions.create({
      messages: mapped,
      thinking: { type: "disabled" },
    })
    const text = completion.choices?.[0]?.message?.content?.trim()
    if (!text) return null
    return { text, provider: "ZAI", model: "glm", latencyMs: Date.now() - started, task }
  } catch {
    return null
  }
}

/** Chat expecting a JSON object back; extracts the first balanced JSON object. */
export async function aiChatJson<T>(messages: AiMessage[], opts: AiCallOptions = {}): Promise<T | null> {
  const result = await aiChat(messages, { ...opts, task: opts.task ?? "classify" })
  if (!result) return null
  return extractJson<T>(result.text)
}

// ─── الإيمبدنج: تمثيل دلالي للنصوص (بحث الذاكرة المعنوي) ───
export interface AiEmbedResult {
  vectors: number[][]
  model: string
  dim: number
  latencyMs: number
}

export async function aiEmbed(texts: string[], opts: { inputType?: "query" | "passage" } = {}): Promise<AiEmbedResult | null> {
  if (!KEY_POOL.length || !texts.length) return null
  const inputType = opts.inputType ?? "query"
  for (const model of modelsLive(EMBED_CHAIN)) {
    for (const key of pickKeys()) {
      const started = Date.now()
      try {
        const res = await fetch(`${NIM_BASE}/embeddings`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model, input: texts, input_type: inputType, truncate: "END" }),
          signal: AbortSignal.timeout(30_000),
        })
        if (!res.ok) {
          if (res.status !== 429) noteFailure(model, res.status)
          noteKeyFailure(key, res.status)
          if (res.status === 429 || res.status === 401 || res.status === 403) continue // مفتاح تاني على نفس الموديل
          break // مشكلة موديل → الموديل التالي
        }
        const data = (await res.json()) as { data?: Array<{ embedding: number[]; index: number }> }
        const vecs = (data.data ?? []).sort((a, b) => a.index - b.index).map((d) => d.embedding)
        if (!vecs.length || !vecs[0].length) {
          noteFailure(model, 500)
          break
        }
        return { vectors: vecs, model, dim: vecs[0].length, latencyMs: Date.now() - started }
      } catch {
        noteFailure(model, 0)
        break
      }
    }
  }
  return null
}

/** تشابه جيب التمام بين متجهين (للبحث الدلالي) */
export function cosineSim(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

// ─── القدرات الخاصة: رؤية / ترجمة / سلامة / تحليل مستندات ───

/** تحويل أي مصدر صورة (رابط http أو data URL) إلى data URL — موديلات NVIDIA الرؤية بتقبل base64 فقط */
async function toDataUrl(imageUrl: string): Promise<string | null> {
  if (imageUrl.startsWith("data:")) return imageUrl
  if (!/^https?:\/\//.test(imageUrl)) return null
  try {
    const res = await fetch(imageUrl, {
      signal: AbortSignal.timeout(20_000),
      headers: { "User-Agent": "Mozilla/5.0 (LeadOS-Agent; compatible)" },
    })
    if (!res.ok) return null
    const type = res.headers.get("content-type") ?? "image/png"
    if (!type.startsWith("image/")) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return `data:${type};base64,${buf.toString("base64")}`
  } catch {
    return null
  }
}

/** تحليل صورة (data URL أو رابط http) بموديل الرؤية */
export async function aiVision(prompt: string, imageUrl: string, opts: AiCallOptions = {}): Promise<AiResult | null> {
  const dataUrl = await toDataUrl(imageUrl)
  if (!dataUrl) return null
  return aiChat(
    [{ role: "user", content: [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: dataUrl } },
    ] }],
    { ...opts, task: "vision" },
  )
}

/** ترجمة نص بموديلات Riva المخصصة */
export async function aiTranslate(text: string, targetLang: string, opts: AiCallOptions = {}): Promise<AiResult | null> {
  return aiChat(
    [{ role: "user", content: `Translate to ${targetLang}: ${text}` }],
    { ...opts, task: "translate", temperature: 0.1 },
  )
}

export interface ModerationResult {
  safe: boolean
  verdict: string
  model: string
  latencyMs: number
}

/** فحص سلامة المحتوى قبل الإرسال (يمنع رسائل مسيئة/مخالفة) */
export async function aiModerate(text: string, opts: AiCallOptions = {}): Promise<ModerationResult | null> {
  const result = await aiChat([{ role: "user", content: text }], { ...opts, task: "moderate", temperature: 0.1 })
  if (!result) return null
  const lower = result.text.toLowerCase()
  const safe = !/unsafe|violat|flagged/.test(lower)
  return { safe, verdict: result.text.slice(0, 200), model: result.model, latencyMs: result.latencyMs }
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
  const pool = keyPoolStatus()
  const hasKey = pool.total > 0
  const tasks = Object.fromEntries(
    (Object.keys(DEFAULT_TASK_CHAINS) as AiTask[]).map((t) => [t, { model: chainFor(t)[0], chain: chainFor(t) }]),
  )
  return {
    nvidia: hasKey && modelsLive(chainFor("chat")).length > 0,
    hasKey,
    keys: pool,
    base: NIM_BASE,
    // توافق خلفي مع الواجهات القديمة
    models: {
      fast: chainFor("classify")[0],
      main: chainFor("chat")[0],
      reason: chainFor("reason")[0],
    },
    chains: {
      fast: chainFor("classify"),
      main: chainFor("chat"),
      reason: chainFor("reason"),
    },
    // الجدول الكامل (dahl أساسي → NVIDIA بدائل)
    tasks,
    catalog: [...DAHL_CATALOG, ...NVIDIA_CATALOG],
    dahl: {
      active: DAHL_KEY_POOL.length > 0,
      keys: dahlKeyPoolStatus(),
      base: DAHL_BASE,
      models: DAHL_CATALOG.map((m) => m.id),
      chains: DAHL_TASK_CHAINS,
      cooling: [...dahlCooldownUntil.entries()].filter(([, t]) => t > Date.now()).length,
    },
    taskLabels: AI_TASK_LABELS,
    cooling: [...cooldownUntil.entries()].filter(([, t]) => t > Date.now()).length,
    note: DAHL_KEY_POOL.length
      ? `dahl (أساسي) — DeepSeek-V4-Flash + MiniMax-M2.7 + GLM-5.3-Flash على 12 مهمة + مجمع مفاتيح (${dahlKeyPoolStatus().live}/${dahlKeyPoolStatus().total} حي) بتبديل تلقائي عند الضغط${hasKey ? ` + NVIDIA NIM بدائل (${pool.live}/${pool.total} مفتاح حي)` : ""} + z-ai طوارئ`
      : hasKey
        ? `NVIDIA NIM — راوتر مهام دقيق: 19 موديل حي موزعين على 13 مهمة + إيمبدنج دلالي + مجمع مفاتيح (${pool.live}/${pool.total} حي)`
        : "أضف DAHL_API_KEY أو NVIDIA_API_KEY في متغيرات البيئة — بدون مفتاح النظام يستخدم المحرك الاستدلالي للكلمات المفتاحية",
  }
}
