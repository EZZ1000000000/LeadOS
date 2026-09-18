// LeadOS — Noise Scan & Cleanup
// Scans ALL leads for noise/garbage patterns and removes them (business + lead + content links).
// Patterns: "title " scrape prefix, job-aggregator listing pages, hashtag names, URL-as-name,
//           clickbait ad language, names that are search-result artifacts.
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

const NOISE_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "title_prefix", re: /^title\s+/i },
  { label: "job_aggregator", re: /^(real\s+)?(estate\s+)?jobs?\s+in\s+.{3,60}(governorate|egypt|cairo|giza|alexandria)/i },
  { label: "job_aggregator_ar", re: /^(وظائف|وظيفة)\s+.{0,40}(مصر|القاهرة|الجيزة|الاسكندرية)/ },
  { label: "hashtag_only", re: /^(\s*#\w+\s*)+$/ },
  { label: "url_as_name", re: /^https?:\/\/\S+$|^www\.\S+$|^\S+\.(com|net|org|eg|io)(\/\S*)?$/i },
  { label: "clickbait", re: /^(try|swipe|check out|download now|subscribe|follow us|limited offer)/i },
  { label: "search_artifact", re: /\.\.\.$/ },
  { label: "too_short", re: /^.{1,4}$/ },
  { label: "listicle", re: /^(أفضل|افضل)\s*\d+\s|^best\s+\d+\s/i },
  // نويسة الجولة الجديدة (بحث ويب مصري): قوائم عربية بدون أرقام + صفحات حجز/مبوبة
  { label: "listicle_ar", re: /^(أفضل|افضل|أحسن|احسن|أقوى|اقوى|أهم|اهم)[\s\-–—:]/u },
  { label: "how_to_choose", re: /(كيف تختار|دليل اختيار|مقارنة أفضل)/ },
  { label: "classifieds", re: /(إعلانات مبوبة|اعلانات مبوبة|إعلانات مجانية)/ },
  { label: "booking_portal", re: /^(book (a table|now)|top \d+ (restaurants|cafes))/i },
  { label: "directory_generic", re: /(directory|listing|b2b marketplace)/i },
]

const URL_NOISE: Array<{ label: string; re: RegExp }> = [
  { label: "fb_answers", re: /facebook\.com\/fb-answers\//i },
  { label: "gaming_sub", re: /reddit\.com\/r\/(playHeroesOfHistory|gaming|memes|LeagueOfLegends|games)/i },
]

function classifyNoise(name: string): string | null {
  const n = (name || "").trim()
  for (const p of NOISE_PATTERNS) if (p.re.test(n)) return p.label
  return null
}

async function main() {
  const leads = await db.lead.findMany({
    include: {
      business: { select: { id: true, name: true } },
      contentLinks: { include: { content: { select: { canonicalUrl: true } } }, take: 1 },
    },
  })
  console.log(`Total leads: ${leads.length}`)

  const noise: Array<{ leadId: string; businessId: string; name: string; pattern: string }> = []
  for (const l of leads) {
    const pattern = classifyNoise(l.business?.name ?? "")
    if (pattern) {
      noise.push({ leadId: l.id, businessId: l.business!.id, name: l.business?.name ?? "", pattern })
      continue
    }
    const url = l.contentLinks[0]?.content.canonicalUrl ?? ""
    const urlNoise = URL_NOISE.find((p) => p.re.test(url))
    if (urlNoise) noise.push({ leadId: l.id, businessId: l.business!.id, name: l.business?.name ?? "", pattern: urlNoise.label })
  }
  console.log(`\nNoise found: ${noise.length}`)
  for (const n of noise) console.log(`  [${n.pattern}] "${n.name.slice(0, 70)}"`)

  if (!noise.length) {
    console.log("\nDatabase is clean ✅")
    process.exit(0)
  }

  for (const n of noise) {
    // remove lead + related rows (cascades handle most), then business
    await db.leadContent.deleteMany({ where: { leadId: n.leadId } })
    await db.leadSource.deleteMany({ where: { leadId: n.leadId } })
    await db.researchRun.deleteMany({ where: { leadId: n.leadId } })
    await db.finding.deleteMany({ where: { leadId: n.leadId } })
    await db.opportunity.deleteMany({ where: { leadId: n.leadId } })
    await db.activity.deleteMany({ where: { leadId: n.leadId } })
    await db.task.deleteMany({ where: { leadId: n.leadId } })
    await db.note.deleteMany({ where: { leadId: n.leadId } })
    await db.leadTag.deleteMany({ where: { leadId: n.leadId } })
    await db.lead.delete({ where: { id: n.leadId } })
    await db.business.delete({ where: { id: n.businessId } }).catch(() => undefined)
    console.log(`🗑 removed: "${n.name.slice(0, 50)}" (${n.pattern})`)
  }

  const total = await db.lead.count()
  console.log(`\nDone. Remaining leads: ${total}`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
