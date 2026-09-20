// LeadOS — استيراد ليدز من CSV / قايمة خارجية (نوع المصدر IMPORT)
// كل صف: { name, phone?, email?, website?, city?, industry?, note? }
// Dedup تلقائي بالتليفون/الاسم — الجديد بيتسجل كـ Business + Lead + تجنيد اختياري في سلسلة النشر
import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { findDuplicateLead, normalizePhone } from "@/lib/dedup"
import { enrollLead } from "@/lib/sequences"

const MAX_ROWS = 500

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const wsId = auth.workspace.id
  const body = await readBody<{
    rows?: Array<{ name?: string; phone?: string; email?: string; website?: string; city?: string; industry?: string; note?: string }>
    autoEnroll?: boolean
  }>(req)
  const rows = (body?.rows ?? []).filter((r) => r?.name?.trim() || r?.phone?.trim())
  if (!rows.length) return jsonError("مفيش صفوف صالحة — كل صف محتاج على الأقل اسم أو تليفون")
  if (rows.length > MAX_ROWS) return jsonError(`الحد الأقصى ${MAX_ROWS} صف في المرة`)

  let created = 0
  let duplicates = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      const name = (row.name?.trim() || row.phone!.trim()).slice(0, 120)
      const phone = row.phone?.trim() ? normalizePhone(row.phone.trim()) : null
      const candidate = {
        id: "",
        name,
        phone,
        email: row.email?.trim() || null,
        websiteUrl: row.website?.trim() || null,
        mapsPlaceId: null,
        city: row.city?.trim() || null,
      }
      const dup = await findDuplicateLead(wsId, candidate)
      if (dup) { duplicates++; continue }

      const business = await db.business.create({
        data: {
          workspaceId: wsId,
          name,
          industry: row.industry?.trim() || null,
          city: row.city?.trim() || null,
          country: "Egypt",
          phone,
          email: row.email?.trim() || null,
          websiteUrl: row.website?.trim() || null,
        },
      })
      const lead = await db.lead.create({
        data: {
          workspaceId: wsId,
          businessId: business.id,
          status: "NEW",
          leadSourceType: "IMPORT",
          intent: "UNKNOWN",
          summary: row.note?.trim() ? row.note.trim().slice(0, 300) : `استيراد يدوي: ${name}`,
          whyNow: "مستورد من قايمة خارجية (CSV)",
          sourceLinks: { create: { sourceType: "IMPORT", label: "استيراد CSV" } },
        },
      })
      created++
      if (body?.autoEnroll !== false) {
        await enrollLead(wsId, lead.id).catch(() => undefined)
      }
    } catch (err) {
      errors.push(`${row.name ?? row.phone}: ${err instanceof Error ? err.message.slice(0, 80) : "خطأ"}`)
    }
  }
  return json({ created, duplicates, errors, total: rows.length }, 201)
}
