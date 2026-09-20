// LeadOS — نقطة دخول عامة: نموذج ليدز الإنباوند + الريفيرال (بدون تسجيل دخول)
// استعمال: POST /api/ingest/form  body: { slug, name, phone?, businessName?, note?, ref? }
// الـ slug هو workspace.slug — الـ ref كود الريفيرال (ليد نوع REFERRAL) — وإلا نوع WEBSITE
// الحماية: honeypot + حد أدنى للطول + سقف 20 ليد/ساعة/ورشة (مكافحة سبام)
import { db } from "@/lib/db"
import { json, jsonError, readBody } from "@/lib/api-helpers"
import { normalizePhone } from "@/lib/dedup"
import { enrollLead } from "@/lib/sequences"

export async function POST(req: Request) {
  const body = await readBody<{
    slug?: string
    name?: string
    phone?: string
    businessName?: string
    note?: string
    ref?: string
    website?: string // honeypot — لازم يفضل فاضي
  }>(req)

  if (body?.website) return jsonError("طلب مرفوض", 400) // bot filled the honeypot
  if (!body?.slug?.trim()) return jsonError("معرّف الورشة مطلوب")
  const contactName = body.name?.trim() ?? ""
  const phone = body.phone?.trim()
  if (!contactName && !phone) return jsonError("محتاج اسم أو رقم تليفون على الأقل")
  if (phone && !/^[+0][0-9\s-]{8,17}$/.test(phone)) return jsonError("رقم التليفون مش شكله صح")

  const ws = await db.workspace.findUnique({ where: { slug: body.slug.trim() }, select: { id: true, name: true } })
  if (!ws) return jsonError("ورشة غير موجودة — اتأكد من الرابط", 404)

  // سقف مكافحة سبام: 20 ليد نموذج/ساعة لكل ورشة
  const hourAgo = new Date(Date.now() - 3600_000)
  const recent = await db.lead.count({
    where: { workspaceId: ws.id, leadSourceType: { in: ["WEBSITE", "REFERRAL"] }, createdAt: { gte: hourAgo } },
  })
  if (recent >= 20) return jsonError("مكتمل الحصة مؤقتًا — جرب بعد شوية", 429)

  const isReferral = Boolean(body.ref?.trim())
  const displayName = body.businessName?.trim() || contactName || phone!
  const business = await db.business.create({
    data: {
      workspaceId: ws.id,
      name: displayName.slice(0, 120),
      country: "Egypt",
      phone: phone ? normalizePhone(phone) : null,
    },
  })
  const lead = await db.lead.create({
    data: {
      workspaceId: ws.id,
      businessId: business.id,
      status: "NEW",
      leadSourceType: (isReferral ? "REFERRAL" : "WEBSITE") as never,
      intent: isReferral ? "HIGH" : "MEDIUM",
      summary: (body.note?.trim() || `دخول من نموذج الإنباوند${isReferral ? ` (ريفيرال: ${body.ref!.trim()})` : ""}`).slice(0, 300),
      whyNow: isReferral ? "جات بريفيرال من عميل قائم — أعلى ثقة" : "سجل نفسه من نموذج الليدز — نية ذاتية",
      sourceLinks: {
        create: {
          sourceType: (isReferral ? "REFERRAL" : "WEBSITE") as never,
          label: isReferral ? `ريفيرال ${body.ref!.trim()}` : "نموذج الإنباوند",
        },
      },
      metadata: { formName: contactName, phone: phone ?? null, ref: body.ref?.trim() ?? null } as never,
    },
  })
  // تجنيد فوري في سلسلة النشر لو مفعّلة (سياسة الرد-فقط: مهمة بنص جاهز)
  await enrollLead(ws.id, lead.id).catch(() => undefined)
  return json({ ok: true, leadId: lead.id, workspace: ws.name }, 201)
}

// GET: جلب معلومات الورشة لعرض النموذج (اسم الورشة بس — بدون بيانات حساسة)
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug")?.trim()
  if (!slug) return jsonError("slug مطلوب")
  const ws = await db.workspace.findUnique({ where: { slug }, select: { name: true } })
  if (!ws) return jsonError("ورشة غير موجودة", 404)
  return json({ workspace: ws })
}
