// LeadOS — Deduplication Layer (doc §11)
// Match signals: phone, email, domain, mapsPlaceId, business name similarity
export type MatchLevel = "EXACT" | "HIGH_CONFIDENCE" | "POSSIBLE" | "NONE"

export interface DedupCandidate {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  websiteUrl?: string | null
  mapsPlaceId?: string | null
  city?: string | null
}

export function normalizePhone(p?: string | null): string | null {
  if (!p) return null
  const digits = p.replace(/\D/g, "")
  if (digits.length < 8) return null
  // Egyptian numbers: keep last 10 digits as canonical
  return digits.slice(-10)
}

export function normalizeDomain(url?: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return null
  }
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(الكافيه|كافيه|المطعم|مطعم|محل|شركة|مركز|عيادة)\s+/, "")
    .replace(/\s+/g, " ")
    .replace(/[إأآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىي]/g, "ي")
    .trim()
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.85
  // token overlap (Jaccard)
  const ta = new Set(na.split(" "))
  const tb = new Set(nb.split(" "))
  const inter = [...ta].filter((t) => tb.has(t)).length
  const union = new Set([...ta, ...tb]).size
  return union ? inter / union : 0
}

export function matchLevel(a: DedupCandidate, b: DedupCandidate): MatchLevel {
  // Exact signals
  const phoneA = normalizePhone(a.phone)
  const phoneB = normalizePhone(b.phone)
  if (phoneA && phoneB && phoneA === phoneB) return "EXACT"
  if (a.mapsPlaceId && b.mapsPlaceId && a.mapsPlaceId === b.mapsPlaceId) return "EXACT"
  const domainA = normalizeDomain(a.websiteUrl)
  const domainB = normalizeDomain(b.websiteUrl)
  if (domainA && domainB && domainA === domainB) return "EXACT"
  if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) return "EXACT"
  // Name similarity
  const sim = nameSimilarity(a.name, b.name)
  if (sim >= 0.85 && (!a.city || !b.city || a.city === b.city)) return "HIGH_CONFIDENCE"
  if (sim >= 0.6) return "POSSIBLE"
  return "NONE"
}

/** Find an existing lead/business matching the incoming candidate. Returns {leadId,businessId,level} or null. */
export async function findDuplicateLead(
  workspaceId: string,
  candidate: DedupCandidate,
): Promise<{ leadId: string; businessId: string | null; level: MatchLevel } | null> {
  const { db } = await import("@/lib/db")
  const leads = await db.lead.findMany({
    where: { workspaceId },
    select: {
      id: true,
      businessId: true,
      business: {
        select: { id: true, name: true, phone: true, email: true, websiteUrl: true, mapsPlaceId: true, city: true },
      },
    },
  })
  let best: { leadId: string; businessId: string | null; level: MatchLevel; rank: number } | null = null
  const rankOf = (l: MatchLevel) => (l === "EXACT" ? 4 : l === "HIGH_CONFIDENCE" ? 3 : 2)
  for (const lead of leads) {
    const biz = lead.business
    if (!biz) continue
    const level = matchLevel(candidate, biz as DedupCandidate)
    if (level === "NONE" || level === "POSSIBLE") continue
    const rank = rankOf(level)
    if (!best || rank > best.rank) best = { leadId: lead.id, businessId: biz.id, level, rank }
  }
  if (!best) return null
  return { leadId: best.leadId, businessId: best.businessId, level: best.level }
}
