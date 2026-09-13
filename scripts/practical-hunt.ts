// التشغيل العملي الكامل — Closed Loop حقيقي:
// Phase 1: أيجنت LeadOS يصيد من خرائط جوجل (هدف جديد: جيمات الشيخ زايد)
// Phase 2: فلترة AI + حصاد تواصل من مواقع الليدز (إيميلات/تليفونات/سوشيال)
// Phase 3: تقرير مفصل بالنتايج
// الاستخدام: bun scripts/practical-hunt.ts [objective]
import { db } from "../src/lib/db"
import { runAgent } from "../src/lib/agent/loop"
import { heuristicClassify } from "../src/lib/classification"

const WS_ID = "cmtyimk8f0002oonlxid1k38p"
const objective = process.argv[2] ?? "جيمات في الشيخ زايد محتاجين نظام حجز أونلاين"

function extractContactsFromHtml(html: string) {
  const emails = [...new Set(html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [])]
    .filter((e) => !/\.(png|jpg|jpeg|gif|webp|svg|css|js)$/i.test(e))
  const phones = [...new Set(html.match(/(?:\+?20\s?|0)1[0125]\s?\d{4}\s?\d{4}/g) ?? [])]
    .map((p) => p.replace(/\s+/g, ""))
  const socials = [...new Set(html.match(/https?:\/\/(?:www\.)?(?:facebook|instagram|linkedin|tiktok|youtube)\.com\/[^\s"'<>)]+/gi) ?? [])]
  return { emails, phones, socials }
}

async function fetchPage(url: string, timeoutMs = 12000) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36", "Accept-Language": "ar,en;q=0.8" },
      redirect: "follow",
    })
    return res.ok ? await res.text() : ""
  } catch { return "" }
}

async function main() {
  const t0 = Date.now()
  console.log("═".repeat(64))
  console.log("🚀 التشغيل العملي — LeadOS Agent Closed Loop")
  console.log(`🎯 الهدف: ${objective}`)
  console.log("═".repeat(64))

  // قبل: عدد الليدز
  const before = await db.lead.count({ where: { workspaceId: WS_ID } })

  // ═══ Phase 1: الصيد بالأيجنت (ذاكرة → خطة → صيد خرائط جوجل) ═══
  console.log("\n▶ Phase 1: الصيد بالأيجنت...")
  const run = await runAgent(WS_ID, objective, {})
  for (const s of run.steps) {
    const icon = s.status === "OK" ? "✓" : s.status === "SKIPPED" ? "⊘" : "✗"
    console.log(`  ${icon} [${s.idx}] ${s.tool} (${s.durationMs}ms) — ${s.note.slice(0, 110)}`)
    if (s.tool === "lead_hunt" && s.data) {
      const d = s.data as { perPlatform?: Array<{ platform: string; items: number; created: number }> }
      for (const p of d.perPlatform ?? []) console.log(`      ↳ ${p.platform}: ${p.items} عنصر → ${p.created} ليد جديد`)
    }
  }
  console.log(`  💬 الملخص: ${run.summary.slice(0, 200)}`)

  // ═══ Phase 2: فلترة AI + حصاد التواصل ═══
  console.log("\n▶ Phase 2: فلترة AI + حصاد بيانات التواصل...")
  const newLeads = await db.lead.findMany({
    where: { workspaceId: WS_ID, createdAt: { gte: new Date(t0) } },
    include: { business: { select: { id: true, name: true, phone: true, email: true, websiteUrl: true, city: true, industry: true, rating: true, reviewCount: true, address: true } } },
    orderBy: { score: "desc" },
  })
  console.log(`  ليدز جديدة من الصيد: ${newLeads.length}`)

  let harvestedPhones = 0, harvestedEmails = 0, harvestedSocials = 0, crawls = 0
  let hot = 0, warm = 0, cold = 0, rejected = 0

  for (const lead of newLeads) {
    const b = lead.business
    if (!b) { rejected++; continue }
    const updates: Record<string, unknown> = {}

    // فلترة AI: إعادة تقييم بمنطق LeadOS (نية/صناعة/سكور)
    const cls = heuristicClassify(b.name, lead.summary ?? `${b.industry ?? ""} ${b.city ?? ""}`, b.name)
    if (!cls.is_lead) { rejected++; console.log(`  ✗ مرفوض بفلتر AI: ${b.name} — ${cls.reason?.slice(0, 60)}`); continue }

    // ختم المدينة: لو البيزنس من غير مدينة والهدف فيه مدينة معروفة → ختمها
    const CITY_HINTS: Array<[RegExp, string]> = [
      [/المعادي/, "المعادي"], [/الشيخ زايد|زايد/, "الشيخ زايد"], [/التجمع/, "التجمع الخامس"],
      [/مدينة نصر/, "مدينة نصر"], [/المهندسين/, "المهندسين"], [/مصر الجديدة/, "مصر الجديدة"], [/6 اكتوبر|اكتوبر/, "6 أكتوبر"],
    ]
    if (!b.city) {
      for (const [re, city] of CITY_HINTS) {
        if (re.test(objective)) { updates.city = city; break }
      }
    }

    // حصاد: لو مفيش تليفون/إيميل وفيه موقع → ازور الموقع
    if (b.websiteUrl && (!b.phone || !b.email)) {
      const html = await fetchPage(b.websiteUrl)
      if (html) {
        crawls++
        const c = extractContactsFromHtml(html)
        if (!b.phone && c.phones.length) { updates.phone = c.phones[0]; harvestedPhones++ }
        if (!b.email && c.emails.length) { updates.email = c.emails[0]; harvestedEmails++ }
        if (c.socials.length) {
          const fb = c.socials.find((s) => /facebook\.com/.test(s))
          const ig = c.socials.find((s) => /instagram\.com/.test(s))
          if ((fb || ig) && !b.mapsUrl) updates.mapsUrl = fb ?? ig
          harvestedSocials += c.socials.length
        }
      }
    }

    // تحديث السكور: سكور AI + بوستات الإثراء (تليفون +10، إيميل +8، تقييمات عالية +5)
    let score = cls.score
    const hasPhone = Boolean(updates.phone ?? b.phone)
    const hasEmail = Boolean(updates.email ?? b.email)
    if (hasPhone) score += 10
    if (hasEmail) score += 8
    if ((b.reviewCount ?? 0) > 50) score += 5
    if (b.rating && b.rating >= 4.5) score += 3
    score = Math.min(100, score)

    await db.lead.update({ where: { id: lead.id }, data: { score, intent: cls.intent } })
    if (Object.keys(updates).length) await db.business.update({ where: { id: b.id }, data: updates })
    if (score >= 70) hot++; else if (score >= 45) warm++; else cold++
  }

  console.log(`  🔥 ساخن (≥70): ${hot} | 🌡 دافئ (45-69): ${warm} | ❄ بارد (<45): ${cold} | مرفوض بفلتر AI: ${rejected}`)
  console.log(`  🕸 مواقع اتزورت: ${crawls} → تليفونات ${harvestedPhones} | إيميلات ${harvestedEmails} | سوشيال ${harvestedSocials}`)

  const after = await db.lead.count({ where: { workspaceId: WS_ID } })
  console.log("\n" + "═".repeat(64))
  console.log(`📊 النتيجة: ${before} → ${after} ليد (+${after - before}) في ${((Date.now() - t0) / 1000).toFixed(0)} ثانية`)
  console.log("═".repeat(64))
  process.exit(0)
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1) })
