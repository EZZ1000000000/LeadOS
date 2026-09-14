// LeadOS — Backfill: تصنيف كل العملاء الحاليين للوحتين (CARDS/AGENCY/BOTH)
// القاعدة: كافيه بدون احتياجات أجنسي → CARDS | كافيه محتاج أجنسي → BOTH | غير كده → AGENCY
// تشغيل محلي:  bun run scripts/backfill-segments.ts
// تشغيل إنتاج: DATABASE_URL="$(cat /tmp/neon_url)" bun run scripts/backfill-segments.ts
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

const AGENCY_KEYS = new Set([
  "website", "mobile_app", "pos", "crm", "erp", "ecommerce", "booking",
  "ordering", "marketing", "automation", "seo", "branding", "cloud", "integrations",
])
const CAFE_RE = /كافيه|كافي|قهوه|كوفي|مقهى|مقاهي|coffee|cafe|espresso/i

function asArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String)
  if (typeof v === "string" && v.startsWith("[")) {
    try { return (JSON.parse(v) as unknown[]).map(String) } catch { return [] }
  }
  return []
}

async function main() {
  const leads = await db.lead.findMany({
    select: {
      id: true,
      segment: true,
      summary: true,
      serviceNeeds: true,
      business: { select: { name: true, category: true, industry: true } },
    },
  })
  let cards = 0, agency = 0, both = 0
  for (const lead of leads) {
    const b = lead.business
    const identity = `${b?.name ?? ""} ${b?.category ?? ""} ${b?.industry ?? ""} ${lead.summary?.slice(0, 200) ?? ""}`
    const cafe = CAFE_RE.test(identity)
    const needs = asArr(lead.serviceNeeds).filter((k) => AGENCY_KEYS.has(k))
    const segment = cafe ? (needs.length ? "BOTH" : "CARDS") : "AGENCY"
    if (segment === lead.segment) {
      // count anyway
      if (segment === "CARDS") cards++; else if (segment === "BOTH") both++; else agency++
      continue
    }
    await db.lead.update({ where: { id: lead.id }, data: { segment } })
    if (segment === "CARDS") cards++; else if (segment === "BOTH") both++; else agency++
  }
  console.log(`backfill done: ${leads.length} leads → CARDS=${cards} AGENCY=${agency} BOTH=${both}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
