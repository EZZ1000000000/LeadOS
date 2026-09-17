// اختبار قاعدة معرفة زيزو: مطابقة الخدمات + الصناعات + معرفة السوق + بذور الصيد + تكرار السَمّ
import { db } from "../src/lib/db"
import { matchServices, servicesHint } from "../src/lib/agent/zizo/services"
import { matchIndustries, marketBrief, sourceBrief, huntSeeds, seedWorkspaceKnowledge } from "../src/lib/agent/zizo/knowledge"

let pass = 0
let fail = 0
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.log(`  ✗ ${name} ${extra}`)
  }
}

async function main() {
  console.log("\n━━━ 1) كتالوج الخدمات الموسّع ━━━")
  const { AGENCY_SERVICES } = await import("../src/lib/agent/zizo/services")
  check(`عدد الخدمات = 17 (فعلًا ${AGENCY_SERVICES.length})`, AGENCY_SERVICES.length === 17)

  const m1 = matchServices("عايز أدير إعلاناتي على فيسبوك وجوجل وكمان سيو للموقع")
  check("مطابقة: إعلانات → ميديا بينج أولًا", Boolean(m1[0]?.id === "media"), m1.map((s) => s.id).join(","))
  check("مطابقة: كلام فيه سيو → SEO موجودة", m1.some((s) => s.id === "seo"))

  const m2 = matchServices("محتاج نظام ERP لمصنعي ومخازن كبيرة")
  check("مطابقة: ERP → برمجة وسوفتوير أولًا", Boolean(m2[0]?.id === "software"), m2.map((s) => s.id).join(","))

  const m3 = matchServices("عايزين أحد نعمل ريلز ونتعامل مع مؤثرين تيك توك")
  check("مطابقة: ريلز/مؤثرين → فيديو أو مؤثرين", m3.some((s) => s.id === "video") && m3.some((s) => s.id === "influencer"))

  const m4 = matchServices("عندنا صفحة فيسبوك مهملة وعايزين حد يديرها ويستضيف موقعنا كويس")
  check("مطابقة: إدارة صفحات + استضافة", m4.some((s) => s.id === "social") && m4.some((s) => s.id === "support"))

  const hint = servicesHint("عايز أعمل متجر شوبيفاي وسيو")
  check("servicesHint بيرجع نص مفيد", hint.includes("مرشحة") && hint.length > 30)

  console.log("\n━━━ 2) خريطة تواجد العملاء ━━━")
  const i1 = matchIndustries("عيادة أسنان في مدينة نصر محتاجة نظام حجز")
  check("مطابقة: عيادة أسنان → صناعة العيادات", Boolean(i1[0]?.id === "clinics"), i1.map((i) => i.id).join(","))
  check("عيادات: أماكن التواجد فيها خرائط جوجل", i1[0]?.where.some((w) => w.includes("خرائط")))

  const i2 = matchIndustries("معرض سيارات وعايز أعلانات على هاتلا2ee")
  check("مطابقة: معرض سيارات", i2.some((i) => i.id === "cars"))
  check("سيارات: أماكنهم فيها هاتلا2ee", Boolean(i2.find((i) => i.id === "cars")?.where.some((w) => w.includes("هاتلا2ee"))))

  const i3 = matchIndustries("مطعم بيتزا جديد في الإسكندرية")
  check("مطابقة: مطعم", Boolean(i3[0]?.id === "restaurants"))

  console.log("\n━━━ 2.5) خدمة GEO الجديدة ━━━")
  const mGeo = matchServices("عايز أظهر عيادتي في إجابات ChatGPT وأعمل GEO")
  check("مطابقة: كلام فيه GEO/ChatGPT → خدمة GEO", mGeo.some((s) => s.id === "geo"), mGeo.map((s) => s.id).join(","))
  const mGeo2 = matchServices("عايز أظهر عيادتي لما حد يسأل الذكاء الاصطناعي بيرشح مين")
  check("مطابقة: «الذكاء الاصطناعي بيرشح» → GEO", mGeo2.some((s) => s.id === "geo"))
  const iClinicGeo = matchIndustries("عيادة أسنان محتاجة حضور أونلاين")
  check("العيادات خدماتها المفضلة فيها geo", Boolean(iClinicGeo[0]?.bestServices.includes("geo")))
  check("حقائق السوق فيها حقيقة GEO", (await import("../src/lib/agent/zizo/knowledge")).MARKET_FACTS.some((f) => f.includes("GEO")))

  console.log("\n━━━ 3) معرفة السوق للبرومبت ━━━")
  const brief = marketBrief("عيادة جلدية محتاجة أجنت يرد على المرضى")
  check("marketBrief: يحتوي معرفة صناعة العيادات", brief.includes("clinics") === false && brief.includes("عيادات"))
  check("marketBrief: فيه زاوية البيع (أجنت حجز)", brief.includes("أجنت"))
  check("marketBrief: فيه نقاط الألم", brief.includes("بيتألموا من") || brief.includes("حجز"))
  check("marketBrief: نص محدود الحجم (< 1200 حرف)", brief.length < 1200, `${brief.length}`)

  const briefEmpty = marketBrief("كلام عام مفيهوش صناعة واضحة نهائيًا")
  check("marketBrief: بيرجع فاضي لكلام عام", briefEmpty === "")

  console.log("\n━━━ 4) معرفة المصادر للصياد ━━━")
  const src = sourceBrief("دورلي على عملاء مطاعم في القاهرة")
  check("sourceBrief: بيرجع مصادر", src.length > 50)
  check("sourceBrief: فيه استعلام جاهز", src.includes("استعلام جاهز"))

  const seeds = huntSeeds("عايز ليدز عيادات أسنان في مصر")
  check("huntSeeds: فيه استعلامات (فعلًا " + seeds.queries.length + ")", seeds.queries.length >= 5)
  check("huntSeeds: فيه منصات مقترحة", seeds.platforms.length >= 1)
  check("huntSeeds: استعلامات فيها صناعة الهدف", seeds.queries.some((q) => q.includes("عيادات")))
  const seedGulf = huntSeeds("زباين من السعودية والإمارات - مطاعم خليجية")
  check("huntSeeds: الهدف الخليجي بيجيب استعلامات", seedGulf.queries.length >= 3)

  console.log("\n━━━ 5) السَمّ التلقائي (idempotent) ━━━")
  const ws = await db.workspace.findFirst({ select: { id: true } })
  if (ws) {
    const before = await db.agentInsight.count({ where: { workspaceId: ws.id } })
    const seeded = await seedWorkspaceKnowledge(ws.id)
    const after = await db.agentInsight.count({ where: { workspaceId: ws.id } })
    check(`إعادة السَمّ بترجع 0 جديدة (فعلًا ${seeded})`, seeded === 0)
    check(`الذاكرة ما اتضاعفتش (${before} → ${after})`, before === after)
    const kinds = await db.agentInsight.groupBy({ by: ["kind"], where: { workspaceId: ws.id }, _count: true })
    const hasSourcing = kinds.find((k) => k.kind === "sourcing")?._count ?? 0
    const hasPresence = kinds.find((k) => k.kind === "presence")?._count ?? 0
    check(`ذاكرة المصادر مسَمَّة (${hasSourcing})`, hasSourcing >= 10)
    check(`ذاكرة التواجد مسَمَّة (${hasPresence})`, hasPresence >= 12)
  }

  console.log(`\n━━━━━━━━━━ النتيجة: ${pass} ✓ / ${fail} ✗ ━━━━━━━━━━`)
  await db.$disconnect()
  process.exit(fail ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
