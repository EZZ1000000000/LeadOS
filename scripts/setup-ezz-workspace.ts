/**
 * تهيئة مساحة حساب المستخدم (ezz / ezzeldenhazam@gmail.com) بالكامل:
 * 1) نسخ كل البيانات الحقيقية من مساحة التشغيل LeadOS (24 ليد + شركات + محتوى + مصادر)
 * 2) إنشاء مصادر البحث (7 منصات)
 * 3) إنشاء قواعد بحث باستهداف مجالات المستخدم بالظبط:
 *    أ) كافيهات شعبي وراقي — عملاء سستم كروت النت
 *    ب) شركات محتاجة خدمات الأجينسي (تسويق / برمجة / تصوير فوتو-فيديو)
 */
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  const src = await db.workspace.findFirst({ where: { slug: "leados-47ngep" } })
  const dst = await db.workspace.findFirst({ where: { slug: "ezz-abuijo" } })
  if (!src || !dst) throw new Error("workspace missing")
  console.log(`COPY: ${src.name}(${src.id}) → ${dst.name}(${dst.id})`)

  // ═══ 1) المصادر ═══
  const srcSources = await db.source.findMany({ where: { workspaceId: src.id } })
  const sourceMap = new Map<string, string>()
  for (const s of srcSources) {
    const exists = await db.source.findFirst({ where: { workspaceId: dst.id, type: s.type, name: s.name } })
    if (exists) { sourceMap.set(s.id, exists.id); continue }
    const created = await db.source.create({
      data: {
        workspaceId: dst.id, type: s.type, name: s.name, status: s.status,
        config: s.config ?? undefined, scheduleCron: s.scheduleCron ?? undefined,
      },
    })
    sourceMap.set(s.id, created.id)
    console.log(`  source: ${s.name} (${s.type})`)
  }

  // مصادر إضافية للمنصات الاجتماعية (تستخدمها الأيجنت وقواعد المستخدم)
  const extraSources: Array<{ type: string; name: string }> = [
    { type: "FACEBOOK", name: "فيسبوك" },
    { type: "INSTAGRAM", name: "انستجرام" },
    { type: "LINKEDIN", name: "لينكدإن" },
  ]
  for (const s of extraSources) {
    const exists = await db.source.findFirst({ where: { workspaceId: dst.id, type: s.type as never } })
    if (exists) continue
    await db.source.create({ data: { workspaceId: dst.id, type: s.type as never, name: s.name, status: "ACTIVE" } })
    console.log(`  source+: ${s.name} (${s.type})`)
  }

  // ═══ 2) الشركات ═══
  const srcBusinesses = await db.business.findMany({ where: { workspaceId: src.id } })
  const bizMap = new Map<string, string>()
  for (const b of srcBusinesses) {
    const dup = b.mapsPlaceId
      ? await db.business.findFirst({ where: { workspaceId: dst.id, mapsPlaceId: b.mapsPlaceId } })
      : await db.business.findFirst({ where: { workspaceId: dst.id, name: b.name } })
    if (dup) { bizMap.set(b.id, dup.id); continue }
    const created = await db.business.create({
      data: {
        workspaceId: dst.id, name: b.name, legalName: b.legalName, category: b.category,
        industry: b.industry, description: b.description, country: b.country, city: b.city,
        region: b.region, address: b.address,
        latitude: b.latitude ?? undefined, longitude: b.longitude ?? undefined,
        phone: b.phone, email: b.email, websiteUrl: b.websiteUrl, mapsUrl: b.mapsUrl,
        mapsPlaceId: b.mapsPlaceId,
        rating: b.rating ?? undefined, reviewCount: b.reviewCount,
        openingHours: b.openingHours ?? undefined, employeeCount: b.employeeCount,
        foundedYear: b.foundedYear, status: b.status, metadata: b.metadata ?? undefined,
      },
    })
    bizMap.set(b.id, created.id)
  }
  console.log(`businesses copied: ${bizMap.size}/${srcBusinesses.length}`)

  // ═══ 3) المحتوى (إعادة ربط بالمصادر الجديدة) ═══
  const srcContents = await db.contentItem.findMany({ where: { workspaceId: src.id } })
  const contentMap = new Map<string, string>()
  for (const c of srcContents) {
    const newSourceId = sourceMap.get(c.sourceId)
    if (!newSourceId) continue
    const dup = await db.contentItem.findFirst({ where: { sourceId: newSourceId, externalId: c.externalId } })
    if (dup) { contentMap.set(c.id, dup.id); continue }
    const created = await db.contentItem.create({
      data: {
        workspaceId: dst.id, sourceId: newSourceId, externalId: c.externalId,
        canonicalUrl: c.canonicalUrl, authorName: c.authorName, authorHandle: c.authorHandle,
        title: c.title, body: c.body, contentType: c.contentType, status: c.status,
        publishedAt: c.publishedAt ?? undefined, language: c.language,
        rawData: c.rawData ?? undefined, contentHash: c.contentHash,
      },
    })
    contentMap.set(c.id, created.id)
  }
  console.log(`contents copied: ${contentMap.size}/${srcContents.length}`)

  // ═══ 4) الليدز (+ leadSources + روابط المحتوى) ═══
  const srcLeads = await db.lead.findMany({
    where: { workspaceId: src.id },
    include: { sourceLinks: true, contentLinks: true },
  })
  let leadsCopied = 0
  for (const l of srcLeads) {
    const newBizId = l.businessId ? bizMap.get(l.businessId) : undefined
    const dupBiz = newBizId
      ? await db.lead.findFirst({ where: { workspaceId: dst.id, businessId: newBizId } })
      : null
    if (dupBiz) continue
    const created = await db.lead.create({
      data: {
        workspaceId: dst.id, businessId: newBizId, status: l.status, temperature: l.temperature,
        intent: l.intent, leadSourceType: l.leadSourceType, score: l.score,
        intentScore: l.intentScore, fitScore: l.fitScore, urgencyScore: l.urgencyScore,
        confidenceScore: l.confidenceScore, serviceNeeds: l.serviceNeeds, painPoints: l.painPoints,
        summary: l.summary, whyNow: l.whyNow, nextBestAction: l.nextBestAction,
        firstSeenAt: l.firstSeenAt, lastSeenAt: l.lastSeenAt,
        lastContactedAt: l.lastContactedAt ?? undefined, nextFollowUpAt: l.nextFollowUpAt ?? undefined,
        metadata: l.metadata ?? undefined,
      },
    })
    for (const ls of l.sourceLinks) {
      await db.leadSource.create({
        data: { leadId: created.id, sourceType: ls.sourceType, sourceUrl: ls.sourceUrl, label: ls.label, metadata: ls.metadata ?? undefined },
      }).catch(() => undefined)
    }
    for (const lc of l.contentLinks) {
      const newContentId = contentMap.get(lc.contentId)
      if (!newContentId) continue
      await db.leadContent.create({
        data: { leadId: created.id, contentId: newContentId, relationship: lc.relationship, relevanceScore: lc.relevanceScore },
      }).catch(() => undefined)
    }
    leadsCopied++
  }
  console.log(`leads copied: ${leadsCopied}/${srcLeads.length}`)

  // ═══ 5) قواعد البحث — استهداف مجالات المستخدم ═══
  const rules: Array<{
    name: string; description: string; priority: number
    cities: string[]; industries: string[]; services: string[]; keywords: string[]
    excludedWords: string[]; sourceTypes: string[]
  }> = [
    {
      name: "كافيهات القاهرة الجديدة والتجمع — عملاء سستم كروت النت",
      description: "كافيهات راقية في القاهرة الجديدة والتجمع الخامس والشويفات — بيع نظام كروت نت/واي فاي",
      priority: 200,
      cities: ["القاهرة الجديدة"],
      industries: ["كافيهات"],
      services: ["واي فاي"],
      keywords: [
        "كافيهات القاهرة الجديدة",
        "كافيهات التجمع الخامس",
        "كافيهات الشويفات",
        "coffee shop New Cairo",
        "كافيه راقي التجمع",
      ],
      excludedWords: ["وظائف", "jobs", "recruitment"],
      sourceTypes: ["GOOGLE_MAPS", "GOOGLE_SEARCH", "INSTAGRAM"],
    },
    {
      name: "كافيهات مدينة نصر والمعادي — عملاء سستم كروت النت",
      description: "كافيهات شعبي وراقي في مدينة نصر والمعادي والزمالك ووسط البلد — بيع نظام كروت نت/واي فاي",
      priority: 200,
      cities: ["مدينة نصر"],
      industries: ["كافيهات"],
      services: ["واي فاي"],
      keywords: [
        "كافيهات مدينة نصر",
        "كافيهات المعادي",
        "كافيهات الزمالك",
        "coffee shop Cairo",
        "كافيه شعبي القاهرة",
      ],
      excludedWords: ["وظائف", "jobs"],
      sourceTypes: ["GOOGLE_MAPS", "GOOGLE_SEARCH", "FACEBOOK"],
    },
    {
      name: "شركات محتاجة خدمات الأجينسي — تسويق/برمجة/تصوير",
      description: "شركات ومطاعم وعيادات ومتاجر مصر محتاجة مركتنج وسوشيال ميديا وسوفت وير وفوتو شوت — عملاء خدمات الأجينسي",
      priority: 190,
      cities: ["القاهرة"],
      industries: ["شركات"],
      services: ["تسويق رقمي"],
      keywords: [
        "شركات محتاجة تسويق مصر",
        "شركة محتاجة سوشيال ميديا",
        "محتاج مصور فوتوغرافي مصر",
        "شركات عايزة برمجة موقع",
        "businesses looking for marketing agency Egypt",
        "محتاج تصميم هوية بصرية مصر",
      ],
      excludedWords: ["وظائف", "jobs"],
      sourceTypes: ["GOOGLE_SEARCH", "GOOGLE_MAPS", "FACEBOOK", "LINKEDIN"],
    },
  ]
  for (const r of rules) {
    const exists = await db.searchRule.findFirst({ where: { workspaceId: dst.id, name: r.name } })
    if (exists) { console.log(`  rule exists: ${r.name}`); continue }
    await db.searchRule.create({
      data: {
        workspaceId: dst.id, name: r.name, description: r.description, enabled: true,
        priority: r.priority, countries: ["Egypt"], cities: r.cities, industries: r.industries,
        services: r.services, keywords: r.keywords, excludedWords: r.excludedWords,
        sourceTypes: r.sourceTypes as never, minLeadScore: 0,
        startResearch: true, researchDepth: "DEEP",
      },
    })
    console.log(`  rule+: ${r.name} (priority=${r.priority})`)
  }

  // ═══ 6) ملخص ═══
  const counts = {
    sources: await db.source.count({ where: { workspaceId: dst.id } }),
    rules: await db.searchRule.count({ where: { workspaceId: dst.id } }),
    businesses: await db.business.count({ where: { workspaceId: dst.id } }),
    leads: await db.lead.count({ where: { workspaceId: dst.id } }),
    contents: await db.contentItem.count({ where: { workspaceId: dst.id } }),
  }
  console.log("\nFINAL ezz workspace:", JSON.stringify(counts))
}

main().finally(() => db.$disconnect())
