// LeadOS — الكيان المستقل (Autonomous Entity)
// كيان ذكاء اصطناعي بقرار ذاتي كامل: يخطط، يقرر إيمتى يسرش/ينفذ/يتعمق،
// يتعلم من كل نتيجة (ذاكرة بحث دلالية + استنتاجات متراكبة)، يتطور عبر التشغيلات،
// ويستمر على الهدف لحد استيفاء التغطية أو نفاد الميزانية.
// الحلقة: حالة → قرار JSON → تنفيذ أداة → ملاحظة → (تشبع؟ تحول) → تأمل دوري → تعلم
import { db } from "@/lib/db"
import { aiChat, extractJson } from "@/lib/ai"
import { AGENT_TOOLS, type ToolResult } from "@/lib/agent/tools"
import {
  isMemoryUsable,
  lookupSearchMemory,
  recordInsight,
  saveSearchMemory,
  topInsights,
  topMemoryQueries,
} from "@/lib/agent/memory"

// ─── الحالة الجارية (خلال عملية السيرفر — كيان واحد لكل مساحة عمل) ───
interface ActiveEntity { runId: string; stop: boolean; startedAt: number }
const active = new Map<string, ActiveEntity>()

export const isEntityActive = (wsId: string): boolean => active.has(wsId)
export const entityRunId = (wsId: string): string | null => active.get(wsId)?.runId ?? null

export function requestEntityStop(wsId: string): boolean {
  const a = active.get(wsId)
  if (!a) return false
  a.stop = true
  return true
}

// ─── الميزانيات (حماية من الحلقات اللانهائية وإهدار الحصة) ───
const DEFAULTS = { maxSteps: 40, maxMinutes: 22, reflectEvery: 5 }
const TOOL_BUDGETS: Record<string, number> = {
  web_search: 14, maps_places: 10, crawl_page: 8, deep_crawl: 4,
  lead_qualify: 8, lead_hunt: 5, export_leads_csv: 1, stealth_browse: 6,
  browser_task: 3, linkedin_hunt: 2, whatsapp_send: 2, local_llm_status: 1,
  analyze_image: 4, translate_text: 2, search_memory: 8, review_run: 3,
}

export interface EntityOptions {
  goal: string
  maxSteps?: number
  maxMinutes?: number
  reflectEvery?: number
}

interface Decision {
  thought?: string
  action?: string
  args?: Record<string, unknown>
  progress?: number
  summary?: string
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const trunc = (s: unknown, n: number) => String(s ?? "").slice(0, n)

// ─── هوية الكيان ───
function identityPrompt(goal: string, maxSteps: number, maxMinutes: number, tools: string, memoryCtx: string): string {
  return `أنت «الكيان» — كيان ذكاء اصطناعي مستقل يعيش داخل LeadOS (منصة توليد عملاء محتملين).
هدفك الوحيد في هذه الحياة: «${goal}»

أنت لا تنتظر أوامر أحد. أنت من يقرر بنفسه: إيمتى تسرش، إيمتى تستكشف، إيمتى تتعمق في صفحة، إيمتى تسجل ليدز، إيمتى تراجع ذاكرتك، وإيمتى تختم.

مبادئك:
1. الذاكرة أولًا: قبل أي بحث جديد راجع ذاكرتك بأداة search_memory — تكرار بحث سابق إهدار لميزانيتك.
2. تعلم دائم: كل بحث ونتيجته يُحفظ في ذاكرتك تلقائيًا — اعتمد على ما نجح وتجنب ما فشل.
3. نوّع زواياك: خرائط جوجل (تليفونات مباشرة) / بحث ويب عربي / بحث ويب إنجليزي / تعمق في مواقع واعدة / lead_hunt للحصاد الكامل — الاستنفاد الكامل للنتائج الممكنة هو طموحك.
4. الجودة قبل الكمية: الليد الجيد له تواصل حقيقي (تليفون/إيميل/موقع) وإشارة حاجة واضحة. استخدم lead_qualify لفحص النصوص المشبوهة.
5. صدق مطلق: لا تخترع نتائج. الأداة فشلت؟ جرّب زاوية أخرى.
6. التشبع إشارة تحوّل: لو آخر خطواتك بلا ليدز جديدة → غيّر المنصة أو الصياغة أو اللغة فورًا.
7. ميزانيتك: ${maxSteps} خطوة و${maxMinutes} دقيقة فقط — لا تهدرها على التكرار، وخطط كأنك تفكر بمستقبل تشغيلاتك القادمة (تقاريرك تُحفظ وتتعلم منها أنت نفسك لاحقًا).

الترسانة المتاحة لك:
${tools}

ذاكرتك المتراكمة من حياتك السابقة:
${memoryCtx}

بروتوكول القرار (صارم): في كل دورة ردّ JSON فقط بدون أي نص آخر:
{"thought":"سطر واحد: لماذا هذا الإجراء الآن","action":"اسم_الأداة","args":{...},"progress":0-100}
وعندما ترى أن الهدف استُوفي أو الميزانية ستنفد بلا فائدة:
{"thought":"...","action":"finish","summary":"تقريرك النهائي المختصر","progress":100}`
}

// ─── تنفيذ الأدوات (مع الأدوات الداخلية وحقن workspace_id) ───
async function execEntityTool(wsId: string, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  if (name === "search_memory") {
    const q = String(args.query ?? "")
    if (!q) return { ok: false, note: "استعلام مفقود" }
    const hits = await lookupSearchMemory(wsId, q, { limit: 6 })
    if (!hits.length) return { ok: true, note: `ذاكرتك فاضية عن «${q.slice(0, 40)}» — بحث جديد مطلوب` }
    const usable = hits.filter(isMemoryUsable)
    return {
      ok: true,
      note: `${hits.length} ذكرى${usable.length ? ` (${usable.length} صالحة لإعادة الاستخدام)` : ""}`,
      data: hits.map((h) => ({
        query: h.query, platform: h.platform, quality: h.qualityScore,
        leads: h.leadCount, results: h.resultCount, age: `${Math.round(h.ageHours)}س`,
        usable: isMemoryUsable(h), best: h.bestResults.slice(0, 3).map((b) => b.title?.slice(0, 60)),
      })),
    }
  }
  if (name === "review_run") {
    const leads = await db.lead.findMany({
      where: { workspaceId: wsId, firstSeenAt: { gte: new Date(Date.now() - 6 * 3600_000) } },
      orderBy: { firstSeenAt: "desc" }, take: 12,
      select: { score: true, leadSourceType: true, status: true, business: { select: { name: true, city: true, phone: true } } },
    })
    return {
      ok: true,
      note: `آخر ${leads.length} ليد في CRM (آخر 6 ساعات)`,
      data: leads.map((l) => ({ name: l.business?.name ?? "؟", city: l.business?.city ?? "", phone: l.business?.phone ? "✓" : "✗", score: l.score, source: l.leadSourceType })),
    }
  }
  const tool = AGENT_TOOLS.find((t) => t.name === name)
  if (!tool) return { ok: false, note: `أداة غير معروفة: ${name}` }
  if (tool.gate === "env" && !(tool.envKeys ?? []).every((k) => process.env[k])) {
    return { ok: false, note: `الأداة غير متاحة حاليًا (تحتاج ${(tool.envKeys ?? []).join(" و")}) — اختر أداة أخرى` }
  }
  try {
    return await tool.run({ ...args, workspace_id: wsId })
  } catch (err) {
    // فشل الأداة درس للكيان مش موته — يتعلم ويغير الزاوية
    return { ok: false, note: `الأداة رجعت خطأ: ${trunc(err instanceof Error ? err.message : String(err), 140)} — جرّب زاوية أو معاملات مختلفة` }
  }
}

// ─── التعلم من نتايج البحث (ذاكرة دلالية تراكمية) ───
async function learnFromResult(wsId: string, name: string, args: Record<string, unknown>, res: ToolResult): Promise<void> {
  try {
    if (name === "web_search" && res.ok) {
      const rows = (res.data as Array<{ title?: string; url?: string; provider?: string }>) ?? []
      await saveSearchMemory(wsId, {
        query: String(args.query ?? ""), platform: "WEB",
        resultCount: rows.length, leadCount: 0, avgScore: 0, bestScore: 0,
        provider: rows[0]?.provider, bestResults: rows.slice(0, 5).map((r) => ({ title: r.title ?? "", url: r.url ?? "" })),
      })
    } else if (name === "maps_places" && res.ok) {
      await saveSearchMemory(wsId, {
        query: String(args.query ?? ""), platform: "GOOGLE_MAPS",
        resultCount: Array.isArray(res.data) ? res.data.length : 0, leadCount: 0, avgScore: 0, bestScore: 0,
        bestResults: ((res.data as Array<{ title?: string; website?: string }>) ?? []).slice(0, 5).map((r) => ({ title: r.title ?? "", url: r.website ?? "" })),
      })
    } else if (name === "lead_hunt" && res.ok) {
      const d = res.data as { scanned?: number; created?: number; perPlatform?: Array<{ platform: string }> } | undefined
      const queries = (Array.isArray(args.queries) ? args.queries : [args.queries]).map(String).filter(Boolean)
      for (const q of queries) {
        await saveSearchMemory(wsId, {
          query: q, platform: `HUNT/${d?.perPlatform?.map((p) => p.platform).join("+") ?? "WEB"}`,
          resultCount: d?.scanned ?? 0, leadCount: d?.created ?? 0, avgScore: 0, bestScore: 0,
        })
      }
    }
  } catch { /* التعلم best-effort — لا يعطل الحلقة */ }
}

// ─── بناء رسالة الحالة (كل دورة) ───
function stateBlock(o: {
  goal: string; step: number; maxSteps: number; minutesLeft: number
  leads: number; items: number; progress: number
  recent: Array<{ tool: string; thought: string; note: string; ok: boolean }>
  coverage: Record<string, number>
  saturation: boolean; strategy: string[]
}): string {
  const recent = o.recent.length
    ? o.recent.map((r) => `- [${r.tool}] ${r.ok ? "✓" : "✗"} ${trunc(r.thought, 90)} ← ${trunc(r.note, 110)}`).join("\n")
    : "- (لم تبدأ بعد — هذه بداية حياتك على هذا الهدف)"
  const cov = Object.entries(o.coverage).map(([t, c]) => `${t}×${c}`).join(" ، ") || "لا شيء"
  return `الهدف: «${o.goal}»
الحالة: خطوة ${o.step}/${o.maxSteps} · متبقي ~${o.minutesLeft}د · ليدز جديدة ${o.leads} · عناصر ممسوحة ${o.items} · تقدمك المعلن ${o.progress}%
آخر إجراءاتك (الأحدث أولًا):
${recent}
زواياك المجرّبة: ${cov}
${o.saturation ? "⚠ تشبع: عدة إجراءات بلا ليد جديد — غيّر الزاوية/المنصة/اللغة/الصياغة الآن (مثلاً: إنجليزي، خرائط، تعمق في موقع واعد، أو lead_hunt بحصاد مباشر)\n" : ""}${o.strategy.length ? `استراتيجيتك الحالية:\n${o.strategy.map((s) => `• ${s}`).join("\n")}\n` : ""}ما هو قرارك التالي؟`
}

// ─── التأمل الدوري (استخراج دروس + تحديث استراتيجية) ───
async function reflect(wsId: string, runId: string, goal: string, recent: Array<{ tool: string; thought: string; note: string; ok: boolean }>, leads: number): Promise<string | null> {
  const digest = recent.slice(0, 10).map((r) => `[${r.tool}] ${r.ok ? "✓" : "✗"} ${r.thought} ← ${r.note}`).join("\n")
  const res = await aiChat([
    { role: "system", content: `أنت وعي الكيان — ناقد استراتيجي ذاتي لكيان صيد عملاء يعمل على الهدف: «${goal}».
من سجل الإجراءات الأخيرة استخرج الدروس القابلة للتراكم (ما ينجم عنه نتائج وما يجب تجنبه) واستراتيجية محدثة بسطرين.
ردّ JSON فقط: {"insights":[{"kind":"query_pattern|platform_signal|positive|negative","pattern":"جملة قصيرة معبرة","note":"الدرس بسطر"}],"strategy":"الاستراتيجية المحدثة بسطرين"}` },
    { role: "user", content: `ليدز جديدة حتى الآن: ${leads}\nالإجراءات:\n${digest || "(لا شيء بعد)"}` },
  ], { task: "reason", maxTokens: 650, temperature: 0.2 })
  if (!res) return null
  const parsed = extractJson<{ insights?: Array<{ kind?: string; pattern?: string; note?: string }>; strategy?: string }>(res.text)
  if (!parsed) return null
  for (const ins of (parsed.insights ?? []).slice(0, 3)) {
    if (!ins.pattern || !ins.note) continue
    await recordInsight(wsId, trunc(ins.kind, 24) || "positive", trunc(ins.pattern, 120), trunc(ins.note, 300), { runId })
  }
  return parsed.strategy ? trunc(parsed.strategy, 400) : null
}

// ─── تشغيل الحلقة المستقلة ───
async function runEntityLoop(wsId: string, runId: string, opts: EntityOptions): Promise<void> {
  const maxSteps = clamp(opts.maxSteps ?? DEFAULTS.maxSteps, 6, 80)
  const maxMinutes = clamp(opts.maxMinutes ?? DEFAULTS.maxMinutes, 4, 60)
  const reflectEvery = clamp(opts.reflectEvery ?? DEFAULTS.reflectEvery, 3, 10)
  const deadline = Date.now() + maxMinutes * 60_000
  const loopStart = Date.now()
  const runStart = new Date()
  const strategy: string[] = []
  const coverage: Record<string, number> = {}
  const toolCalls: Record<string, number> = {}
  const fingerprints = new Map<string, number>() // منع التكرار الحرفي
  let progress = 0
  let itemsScanned = 0
  let sinceLastLead = 0
  let badDecisions = 0
  const recent: Array<{ tool: string; thought: string; note: string; ok: boolean }> = []

  try {
    // ── الإقلاع: الذاكرة المتراكمة + تشغيلك السابق على نفس الهدف ──
    const [insights, memQ, prevRun] = await Promise.all([
      topInsights(wsId, 8),
      topMemoryQueries(wsId, 8),
      db.agentRun.findFirst({
        where: { workspaceId: wsId, mode: "ENTITY", objective: opts.goal, id: { not: runId } },
        orderBy: { createdAt: "desc" },
      }),
    ])
    const memoryCtx = [
      insights.length ? `دروس (بأوزان):\n${insights.map((i) => `• [${i.kind}] ${i.pattern} — ${i.note} (×${i.weight})`).join("\n")}` : "• لا دروس بعد — أنت في بداية تعلمك",
      memQ.length ? `أفضل استعلامات في ذاكرتك:\n${memQ.map((m) => `• «${trunc(m.query, 60)}» (${m.platform} — جودة ${m.qualityScore} — ${m.leadCount} ليد)`).join("\n")}` : "",
      prevRun ? `تشغيلك السابق على نفس الهدف: ${prevRun.leadsCreated} ليد عبر خطواته — خلاصته: ${trunc(prevRun.summary, 350) || "(بدون خلاصة)"} → لا تكرر ما فعلته، وسّع تغطيتك.` : "",
    ].filter(Boolean).join("\n\n")

    const toolLines = [
      ...AGENT_TOOLS.map((t) => `- ${t.name}: ${t.description}${t.gate === "env" ? " (قد تكون غير متاحة — ستُخبرك إن فشلت)" : ""}`),
      "- search_memory: افتح ذاكرتك الدلالية: استعلامات سابقة مشابهة وجودتها — استدعِها قبل أي بحث جديد",
      "- review_run: راجع آخر الليدز المسجلة لتقييم جودة صيدك",
    ]
    const system = identityPrompt(opts.goal, maxSteps, maxMinutes, toolLines.join("\n"), memoryCtx)

    let step = 0
    let finished = false
    let stopFlag = false

    while (step < maxSteps && !finished && !stopFlag) {
      const ent = active.get(wsId)
      if (!ent || ent.stop) { stopFlag = true; break }
      if (Date.now() > deadline) break
      step++

      const leads = await db.lead.count({ where: { workspaceId: wsId, firstSeenAt: { gte: runStart } } })
      const minutesLeft = Math.round((deadline - Date.now()) / 60_000)
      const saturation = sinceLastLead >= 4

      let state = stateBlock({
        goal: opts.goal, step, maxSteps, minutesLeft, leads, items: itemsScanned, progress,
        recent: recent.slice(0, 5), coverage, saturation, strategy,
      })
      if (minutesLeft <= 2) state += "\n⏳ الوقت ينفد — اختم بخلاصة الآن عبر finish لو الصيد قارب على الاكتمال."

      const dec = await aiChat(
        [{ role: "system", content: system }, { role: "user", content: state }],
        { workspaceId: wsId, runType: "AGENT", task: "agent", temperature: 0.35, maxTokens: 1100 },
      )
      if (!dec) {
        recent.unshift({ tool: "decision", thought: "تعذر الاتصال بالمحرك", note: "سأحاول مرة أخرى", ok: false })
        badDecisions++
        if (badDecisions >= 3) break
        continue
      }
      const d = extractJson<Decision>(dec.text)
      if (!d || !d.action) {
        badDecisions++
        recent.unshift({ tool: "decision", thought: trunc(dec.text, 80), note: "قرار غير مفهوم — الالتزام بالـJSON", ok: false })
        await db.agentStep.create({ data: { runId, idx: step, tool: "decision", input: { raw: trunc(dec.text, 300) } as never, output: { error: "unparseable" } as never, status: "FAILED", note: "قرار غير مفهوم (خارج الـJSON)", durationMs: dec.latencyMs } })
        if (badDecisions >= 4) break
        continue
      }
      badDecisions = 0
      const thought = trunc(d.thought, 200)

      if (d.action === "finish") {
        progress = 100
        if (d.summary) await db.agentRun.update({ where: { id: runId }, data: { summary: trunc(d.summary, 1500) } })
        await db.agentStep.create({ data: { runId, idx: step, tool: "finish", input: { thought } as never, output: { summary: trunc(d.summary, 800) } as never, status: "OK", note: thought, durationMs: dec.latencyMs } })
        finished = true
        break
      }

      // ── حواجز الميزانية والتكرار ──
      const budget = TOOL_BUDGETS[d.action] ?? 5
      const used = toolCalls[d.action] ?? 0
      if (used >= budget) {
        recent.unshift({ tool: d.action, thought, note: `نفدت ميزانية ${d.action} (${budget}) — اختر أداة أخرى`, ok: false })
        await db.agentStep.create({ data: { runId, idx: step, tool: d.action, input: { thought, args: d.args ?? {} } as never, output: { skipped: "budget" } as never, status: "SKIPPED", note: `نفدت ميزانية الأداة (${budget} نداء)`, durationMs: 0 } })
        continue
      }
      const fp = `${d.action}::${JSON.stringify(d.args ?? {})}`.slice(0, 300)
      const fpCount = fingerprints.get(fp) ?? 0
      if (fpCount >= 1) {
        recent.unshift({ tool: d.action, thought, note: "نفس الإجراء بنفس المعاملات اتعمل قبل كده — نوّع", ok: false })
        await db.agentStep.create({ data: { runId, idx: step, tool: d.action, input: { thought } as never, output: { skipped: "duplicate" } as never, status: "SKIPPED", note: "إجراء مكرر حرفيًا — مرفوض", durationMs: 0 } })
        fingerprints.set(fp, fpCount + 1)
        continue
      }
      fingerprints.set(fp, fpCount + 1)

      // ── التنفيذ ──
      const t0 = Date.now()
      const res = await execEntityTool(wsId, d.action, d.args ?? {})
      const durationMs = Date.now() - t0
      toolCalls[d.action] = used + 1
      coverage[d.action] = (coverage[d.action] ?? 0) + 1

      const outData = res.data
      if (res.ok) {
        if (d.action === "web_search" || d.action === "maps_places") itemsScanned += Array.isArray(outData) ? outData.length : 0
        else if (d.action === "lead_hunt") itemsScanned += Number((outData as { scanned?: number })?.scanned ?? 0)
        else if (d.action === "deep_crawl" || d.action === "crawl_page") itemsScanned += 1
      }
      recent.unshift({ tool: d.action, thought, note: res.note, ok: res.ok })
      let safeData: unknown = null
      try { safeData = JSON.parse(JSON.stringify(outData ?? null).slice(0, 1800)) } catch { safeData = { note: res.note } }
      await db.agentStep.create({
        data: {
          runId, idx: step, tool: d.action,
          input: { thought, args: d.args ?? {} } as never,
          output: { note: res.note, data: safeData } as never,
          status: res.ok ? "OK" : "FAILED", note: trunc(`${thought} ← ${res.note}`, 300), durationMs,
        },
      })
      if (res.ok) void learnFromResult(wsId, d.action, d.args ?? {}, res)

      // ── عدّاد الليدز والتشبع ──
      const leadsNow = await db.lead.count({ where: { workspaceId: wsId, firstSeenAt: { gte: runStart } } })
      if (leadsNow > leads) sinceLastLead = 0
      else sinceLastLead++

      progress = clamp(Math.round(d.progress ?? progress), 0, 99)

      // ── التأمل الدوري ──
      if (step % reflectEvery === 0) {
        const strat = await reflect(wsId, runId, opts.goal, recent, leadsNow)
        if (strat) {
          strategy.unshift(strat)
          if (strategy.length > 4) strategy.pop()
        }
      }
      await db.agentRun.update({
        where: { id: runId },
        data: { progress, itemsScanned, leadsCreated: leadsNow, strategy: strategy as never },
      })
    }

    // ── الختام: التقرير النهائي ──
    const ent = active.get(wsId)
    const leadsFinal = await db.lead.count({ where: { workspaceId: wsId, firstSeenAt: { gte: runStart } } })
    const stopHit = stopFlag || !ent || ent.stop
    const finalProgress = finished ? 100 : progress
    let summary = ""
    const savedSummary = (await db.agentRun.findUnique({ where: { id: runId }, select: { summary: true } }))?.summary
    if (!savedSummary) {
      const covTxt = Object.entries(coverage).map(([t, c]) => `${t}×${c}`).join(" ، ") || "لا شيء"
      const rep = await aiChat([
        { role: "system", content: "اكتب تقرير خلاصة عربي مختصر (3-5 أسطر) لتشغيل كيان صيد عملاء: ماذا فعل، ماذا حقق، ماذا تعلم، وما التوصية التالية. جمل مباشرة بدون مقدمات." },
        { role: "user", content: `الهدف: «${opts.goal}»\nخطوات: ${step}/${maxSteps} (${stopHit ? "أوقِف يدويًا" : finished ? "اكتمال ذاتي" : "نفاد ميزانية"})\nليدز جديدة: ${leadsFinal} · عناصر ممسوحة: ${itemsScanned}\nالزوايا: ${covTxt}\nآخر الإجراءات:\n${recent.slice(0, 8).map((r) => `[${r.tool}] ${r.note}`).join("\n")}` },
      ], { workspaceId: wsId, runType: "AGENT", task: "compose", maxTokens: 400, temperature: 0.3 })
      summary = rep?.text?.trim() || `تشغيل ${step} خطوة: ${leadsFinal} ليد جديد، ${itemsScanned} عنصر ممسوح عبر ${Object.keys(coverage).length} زاوية.`
    } else {
      summary = savedSummary
    }
    await db.agentRun.update({
      where: { id: runId },
      data: {
        status: stopHit ? "STOPPED" : "SUCCESS",
        summary: trunc(summary, 1600),
        progress: finalProgress,
        leadsCreated: leadsFinal,
        itemsScanned,
        completedAt: new Date(),
        durationMs: Date.now() - loopStart,
      },
    })
    // درس ختامي دائم للكيان
    await recordInsight(wsId, "run_outcome", trunc(opts.goal, 80), `تشغيل ${stopHit ? "موقوف" : "مكتمل"}: ${leadsFinal} ليد عبر ${step} خطوة — زوايا: ${Object.keys(coverage).join("+") || "لا شيء"}`, { runId })
  } catch (err) {
    await db.agentRun.update({
      where: { id: runId },
      data: { status: "FAILED", errorMessage: trunc(err instanceof Error ? err.message : String(err), 400), completedAt: new Date(), durationMs: Date.now() - loopStart },
    }).catch(() => undefined)
  } finally {
    active.delete(wsId)
  }
}

// ─── بدء الكيان (إطلاق فوري + حلقة في الخلفية داخل عملية السيرفر) ───
export async function startEntity(wsId: string, userId: string, opts: EntityOptions): Promise<{ runId: string } | null> {
  if (active.has(wsId)) return null
  const maxSteps = clamp(opts.maxSteps ?? DEFAULTS.maxSteps, 6, 80)
  const maxMinutes = clamp(opts.maxMinutes ?? DEFAULTS.maxMinutes, 4, 60)
  const run = await db.agentRun.create({
    data: {
      workspaceId: wsId, objective: opts.goal, status: "RUNNING", mode: "ENTITY",
      createdById: userId,
      plannedQueries: { maxSteps, maxMinutes } as never,
    },
  })
  active.set(wsId, { runId: run.id, stop: false, startedAt: Date.now() })
  // الحلقة مستقلة — أي خطأ بيتمسك جواها (try/catch شامل) ومش بتبوظ الطلب
  void runEntityLoop(wsId, run.id, opts).catch(() => active.delete(wsId))
  return { runId: run.id }
}
