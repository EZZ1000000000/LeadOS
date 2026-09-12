// LeadOS — Agent Loop (العقل المنظم)
// دورة تشغيل كاملة: فهم الهدف → سرش للسرش (ذاكرة) → تخطيط استعلامات → اختيار منصات
// → صيد ليدز → حصاد بيانات تواصل → حفظ الذاكرة + الاستنتاجات → تقرير مفصل بخطوات
import { db } from "@/lib/db"
import { AGENT_TOOLS } from "@/lib/agent/tools"
import {
  lookupSearchMemory, isMemoryUsable, saveSearchMemory, recordInsight, type MemoryHit,
} from "@/lib/agent/memory"

export interface AgentRunOptions {
  platforms?: string[]
  forceFresh?: boolean // تجاهل الذاكرة واعمل صيد جديد
  exportCsv?: boolean
  maxSteps?: number
}

export interface AgentStepTrace {
  idx: number
  tool: string
  note: string
  status: string
  durationMs: number
  data?: unknown
}

// ---------- فهم الهدف: استخراج مدينة/صناعة/خدمة ----------
const CITY_MAP: Array<[RegExp, string]> = [
  [/التجمع الخامس|التجمع/, "التجمع الخامس"],
  [/مدينة نصر/, "مدينة نصر"],
  [/المعادي/, "المعادي"],
  [/الشيخ زايد|زايد/, "الشيخ زايد"],
  [/6 اكتوبر|السادس من اكتوبر|اكتوبر/, "6 أكتوبر"],
  [/المهندسين/, "المهندسين"],
  [/مصر الجديدة|هليوبوليس/, "مصر الجديدة"],
  [/وسط البلد|وسط القاهرة/, "وسط القاهرة"],
  [/الزمالك/, "الزمالك"],
  [/القاهرة|cairo/i, "القاهرة"],
  [/الجيزة|جيزة|giza/i, "الجيزة"],
  [/الاسكندريه|الإسكندرية|اسكندرية|alexandria/i, "الإسكندرية"],
  [/المنصورة/, "المنصورة"],
  [/طنطا/, "طنطا"],
  [/أسيوط|اسيوط/, "أسيوط"],
  [/السويس/, "السويس"],
  [/بورسعيد/, "بورسعيد"],
  [/الشرقية|الزقازيق/, "الشرقية"],
  [/المنيا/, "المنيا"],
  [/أسوان|اسوان/, "أسوان"],
  [/الأقصر|اقصر/, "الأقصر"],
  [/بني سويف/, "بني سويف"],
  [/دمياط/, "دمياط"],
]
const INDUSTRY_MAP: Array<[RegExp, string]> = [
  [/عياد|دكتور|دكاترة|أسنان|اسنان|dentist|clinic|طبيب|أطباء|اطباء/, "عيادات"],
  [/مطعم|مطاعم|كافيه|قهوة|كوفي|restaurant|cafe|coffee/, "مطاعم وكافيهات"],
  [/متجر|تجارة|بيع|retail|store|ecommerce|تجارة إلكترونية|انستجرام/, "متاجر"],
  [/جيم|نادي|جيمز|gym|fitness|فيتنس/, "جيمات"],
  [/صالون|حلاق|barber|salon|تجميل/, "صالونات"],
  [/عقار|عقارات|real estate|مكتب عقاري/, "عقارات"],
  [/صيدلي|صيدلية|pharmacy/, "صيدليات"],
  [/شركة|شركات|startups?|سوفتوير|برمجيات/, "شركات"],
  [/مصنع|مصانع|factory/, "مصانع"],
  [/محامي|محاماة|law|legal/, "مكاتب محاماة"],
]
const SERVICE_MAP: Array<[RegExp, string]> = [
  [/حجز|حجوزات|booking|reservation/, "نظام حجز"],
  [/كاشير|pos|نقاط بيع/, "كاشير POS"],
  [/موقع|website|ويب/, "موقع إلكتروني"],
  [/تطبيق|app|موبايل/, "تطبيق موبايل"],
  [/crm|إدارة عملاء|ادارة عملاء|علاقات/, "CRM"],
  [/erp|محاسبة|accounting/, "ERP"],
  [/متجر إلكتروني|متجر الكتروني|ecommerce|ستور/, "متجر إلكتروني"],
  [/تسويق|marketing|اعلانات|إعلانات|ads/, "تسويق رقمي"],
  [/دليفري|طلبات|ordering|delivery/, "نظام طلبات"],
  [/برمج|تطوير|developer|software|نظام/, "برمجيات"],
]

function extractEntity(objective: string, map: Array<[RegExp, string]>): string | null {
  for (const [re, val] of map) {
    const m = objective.match(re)
    if (m) return typeof val === "string" ? val : (val as (s: string) => string)(m[0])
  }
  return null
}

function planQueries(objective: string): { city: string | null; industry: string | null; service: string | null; queries: string[] } {
  const city = extractEntity(objective, CITY_MAP)
  const industry = extractEntity(objective, INDUSTRY_MAP)
  const service = extractEntity(objective, SERVICE_MAP)
  const queries: string[] = [objective]
  if (industry && city) queries.push(`${industry} ${city} محتاج ${service ?? "نظام"}`)
  else if (industry) queries.push(`${industry} مصر محتاج ${service ?? "نظام"}`)
  if (industry && city) queries.push(`${industry === "عيادات" ? "clinics" : industry === "مطاعم وكافيهات" ? "restaurants cafes" : "businesses"} in ${city} looking for ${service ?? "software"}`)
  if (industry && city) queries.push(`${industry} ${city} توصيل مواقع` ) // استعلام مكان لليدز المحلية
  return { city, industry, service, queries: [...new Set(queries)].slice(0, 5) }
}

function choosePlatforms(objective: string, hinted?: string[]): string[] {
  if (hinted?.length) return hinted
  const platforms = new Set<string>(["GOOGLE_MAPS", "GOOGLE_SEARCH"])
  if (/انستجرام|instagram|براند/i.test(objective)) platforms.add("INSTAGRAM")
  if (/فيسبوك|facebook|جروب/i.test(objective)) platforms.add("FACEBOOK")
  if (/لينكدإن|لينكد|linkedin|توظيف|وظايف|hiring/i.test(objective)) { platforms.add("LINKEDIN"); platforms.add("JOBS") }
  if (/ريديت|reddit/i.test(objective)) platforms.add("REDDIT")
  if (/أخبار|اخبار|افتتاح|توسع|news/i.test(objective)) platforms.add("NEWS")
  if (/تيك توك|tiktok/i.test(objective)) platforms.add("TIKTOK")
  if (/يوتيوب|youtube/i.test(objective)) platforms.add("YOUTUBE")
  if (/دليل|أدلة|yellow|directory/i.test(objective)) platforms.add("DIRECTORY")
  return [...platforms].slice(0, 5)
}

// ---------- الحلقة ----------
export async function runAgent(
  wsId: string,
  objective: string,
  opts: AgentRunOptions = {},
): Promise<{ runId: string; status: string; summary: string; steps: AgentStepTrace[]; leadsCreated: number; reusedMemory: boolean }> {
  const t0 = Date.now()
  const maxSteps = opts.maxSteps ?? 14
  const run = await db.agentRun.create({
    data: { workspaceId: wsId, objective, status: "RUNNING", platforms: (opts.platforms ?? []) as never },
  })
  const steps: AgentStepTrace[] = []
  let idx = 0

  async function step(tool: string, note: string, status: string, durationMs: number, data?: unknown, input?: unknown) {
    idx++
    if (idx > maxSteps) return
    const s: AgentStepTrace = { idx, tool, note, status, durationMs }
    if (data !== undefined) s.data = data
    steps.push(s)
    await db.agentStep.create({
      data: { runId: run.id, idx, tool, note: note.slice(0, 500), status, durationMs, input: (input ?? undefined) as never, output: (data ?? undefined) as never },
    }).catch(() => undefined)
  }

  async function exec(toolName: string, args: Record<string, unknown>): Promise<ReturnType<typeof AGENT_TOOLS[0]["run"]>> {
    const tool = AGENT_TOOLS.find((t) => t.name === toolName)
    if (!tool) {
      await step(toolName, "أداة غير موجودة", "FAILED", 0, undefined, args)
      return { ok: false, note: "أداة غير موجودة" }
    }
    const gated = tool.gate === "env" && !(tool.envKeys ?? []).every((k) => Boolean(process.env[k]))
    if (gated) {
      const note = `أداة ${toolName} متعطلة — تحتاج: ${(tool.envKeys ?? []).join(", ")} في البيئة`
      await step(toolName, note, "SKIPPED", 0, undefined, args)
      return { ok: false, note }
    }
    const t = Date.now()
    try {
      const result = await tool.run(args)
      await step(toolName, result.note, result.ok ? "OK" : "FAILED", Date.now() - t, result.data, args)
      return result
    } catch (err) {
      const note = `فشل تنفيذ ${toolName}: ${err instanceof Error ? err.message.slice(0, 120) : err}`
      await step(toolName, note, "FAILED", Date.now() - t, undefined, args)
      return { ok: false, note }
    }
  }

  try {
    // 1) سرش للسرش: الذاكرة الأول
    const tMem = Date.now()
    const memoryHits = await lookupSearchMemory(wsId, objective)
    const usable = !opts.forceFresh ? memoryHits.find(isMemoryUsable) : undefined
    await step(
      "memory_search",
      usable
        ? `ذاكرة قوية لقاها! «${usable.query}» (جودة ${usable.qualityScore}، ${usable.leadCount} ليد، عمرها ${usable.ageHours} ساعة) — هنستخدمها بدون ويب`
        : memoryHits.length
          ? `الذاكرة فيها ${memoryHits.length} استعلام قريب بس مش كفاية (جودة/حداثة أقل من الحد) — هنكمل للويب`
          : "الذاكرة فاضية من الاستعلام ده — أول مرة، هندور على الويب",
      "OK", Date.now() - tMem,
      memoryHits.map((h) => ({ query: h.query, platform: h.platform, quality: h.qualityScore, leads: h.leadCount, similarity: h.similarity })),
    )

    let reusedMemory = false
    let leadsCreated = 0
    let itemsScanned = 0

    if (usable) {
      // 2) الرد من الذاكرة — صفر بحث ويب
      reusedMemory = true
      await step("memory_reuse", `أعدنا استخدام نتايج «${usable.query}» من الذاكرة (${usable.bestResults.length} أفضل نتيجة محفوظة)`, "OK", 0, usable.bestResults)
      await db.searchMemory.update({ where: { id: usable.id }, data: { hitCount: { increment: 1 }, lastUsedAt: new Date() } }).catch(() => undefined)
      await recordInsight(wsId, "positive", `reuse:${usable.query}`, `الذاكرة غطت الهدف «${objective.slice(0, 50)}» بدون ويب`, { hitCount: usable.hitCount + 1 })
      leadsCreated = usable.leadCount
      itemsScanned = usable.resultCount
    } else {
      // 3) التخطيط
      const plan = planQueries(objective)
      const platforms = choosePlatforms(objective, opts.platforms)
      await db.agentRun.update({ where: { id: run.id }, data: { plannedQueries: plan.queries as never } })
      await step(
        "plan",
        `فهمت الهدف: ${[plan.industry && `صناعة=${plan.industry}`, plan.city && `مدينة=${plan.city}`, plan.service && `خدمة=${plan.service}`].filter(Boolean).join(" | ") || "بحث عام"} — منصات: ${platforms.join(", ")}`,
        "OK", 0, { queries: plan.queries, platforms },
      )

      // 4) الصيد عبر المنصات
      const tHunt = Date.now()
      const hunt = await exec("lead_hunt", { workspace_id: wsId, queries: plan.queries, platforms })
      const huntData = (hunt.data ?? {}) as { scanned?: number; created?: number; duplicates?: number; perPlatform?: Array<{ platform: string; items: number; created: number }> }
      leadsCreated = huntData.created ?? 0
      itemsScanned = huntData.scanned ?? 0
      if (!hunt.ok) {
        await step("hunt_failed", hunt.note, "FAILED", Date.now() - tHunt)
      }

      // 5) حصاد بيانات التواصل من مواقع الليدز الجديدة (عين الأيجنت على أرض الواقع)
      const newLeads = await db.lead.findMany({
        where: { workspaceId: wsId, createdAt: { gte: new Date(t0) } },
        include: { business: { select: { id: true, name: true, websiteUrl: true, phone: true } } },
        take: 8,
      })
      const crawlable = newLeads.filter((l) => l.business?.websiteUrl && !l.business?.phone).slice(0, 4)
      let harvested = 0
      for (const l of crawlable) {
        const res = await exec("crawl_page", { url: l.business!.websiteUrl })
        const contacts = (res.data ?? {}) as { emails?: string[]; phones?: string[] }
        if (res.ok && contacts.phones?.length) {
          await db.business.update({ where: { id: l.business!.id }, data: { phone: contacts.phones[0] } }).catch(() => undefined)
          harvested++
        }
      }
      if (crawlable.length) {
        await recordInsight(wsId, "contact_harvest", `harvest:${crawlable.length}`, `حصدنا تليفونات من ${harvested}/${crawlable.length} موقع ليدز جديدة`)
        await step("harvest_summary", `حصاد التواصل: ${harvested} تليفون من ${crawlable.length} موقع`, "OK", 0, { harvested, attempted: crawlable.length })
      }

      // 6) حفظ الذاكرة لكل استعلام × منصة (الذاكرة العامة للبحث)
      const recentLeads = await db.lead.findMany({
        where: { workspaceId: wsId, createdAt: { gte: new Date(t0) } },
        select: { score: true },
      })
      const avgScore = recentLeads.length ? Math.round(recentLeads.reduce((a, l) => a + l.score, 0) / recentLeads.length) : 0
      const bestScore = recentLeads.length ? Math.max(...recentLeads.map((l) => l.score)) : 0
      for (const p of huntData.perPlatform ?? []) {
        await saveSearchMemory(wsId, {
          query: objective,
          platform: p.platform,
          resultCount: p.items,
          leadCount: p.created,
          avgScore,
          bestScore,
          provider: "agent",
          bestResults: (p as { topItems?: Array<{ title: string; url: string }> }).topItems ?? [],
        }).catch(() => undefined)
      }
      await step(
        "memory_save",
        `اتحفظت الذاكرة: ${plan.queries.length} استعلام × ${huntData.perPlatform?.length ?? 0} منصة — جودة محسوبة من ${recentLeads.length} ليد جديد`,
        "OK", 0, { avgScore, bestScore, leadsCreated },
      )

      // 7) استنتاجات: أي منصة كانت أحسن منجم؟
      const bestPlatform = (huntData.perPlatform ?? []).sort((a, b) => b.created - a.created)[0]
      if (bestPlatform && bestPlatform.created > 0) {
        await recordInsight(wsId, "platform_signal", bestPlatform.platform, `منجم ${bestPlatform.platform} طلّع ${bestPlatform.created} ليد من هدف «${objective.slice(0, 40)}»`, bestPlatform)
      }
      if (leadsCreated === 0) {
        await recordInsight(wsId, "negative", `zero_yield:${objective.slice(0, 50)}`, "الهدف ده ما طلّعش ليدز — جرّب صياغة أوسع أو منصات تانية", { platforms })
      }
    }

    // 8) تصدير اختياري
    if (opts.exportCsv) {
      await exec("export_leads_csv", { workspace_id: wsId, min_score: 0 })
    }

    const durationMs = Date.now() - t0
    const summary = reusedMemory
      ? `ذاكرة: استخدمنا نتايج محفوظة (${steps.length} خطوة، صفر بحث ويب)`
      : `صيد جديد: ${leadsCreated} ليد من ${itemsScanned} عنصر (${steps.length} خطوة، ${(durationMs / 1000).toFixed(1)}s)`
    await db.agentRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        summary,
        leadsCreated,
        itemsScanned,
        memoryHits: memoryHits.length,
        reusedMemory,
        durationMs,
        completedAt: new Date(),
      },
    })
    return { runId: run.id, status: "SUCCESS", summary, steps, leadsCreated, reusedMemory }
  } catch (err) {
    const durationMs = Date.now() - t0
    const msg = err instanceof Error ? err.message.slice(0, 300) : String(err)
    await db.agentRun.update({
      where: { id: run.id },
      data: { status: "FAILED", errorMessage: msg, durationMs, completedAt: new Date() },
    }).catch(() => undefined)
    return { runId: run.id, status: "FAILED", summary: `فشل: ${msg}`, steps, leadsCreated: 0, reusedMemory: false }
  }
}
