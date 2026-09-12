// إصلاح باتش: ختم المدن على الليدز الأخيرة بلا مدينة (حسب الهدف) + حذف ضوضاء المنافسين
import { db } from "../src/lib/db"

const WS_ID = "cmtyimk8f0002oonlxid1k38p"
const CITY_HINTS: Array<[RegExp, string]> = [
  [/المعادي/, "المعادي"], [/الشيخ زايد|زايد/, "الشيخ زايد"], [/التجمع/, "التجمع الخامس"],
  [/مدينة نصر/, "مدينة نصر"], [/المهندسين/, "المهندسين"], [/مصر الجديدة/, "مصر الجديدة"], [/6 اكتوبر|اكتوبر/, "6 أكتوبر"],
]
// ضوضاء: إعلانات منافسين (برامج/أنظمة كاشير وERP) + بوستات شخصية — مش ليدز
const NOISE = [
  /ريتم ERP|نظام واحد للشركة/, /نظام إدارة الصيدليات/, /برامج كاشير/, /جهاز كاشير/, /كاشير كامل للبيع/,
  /RX by|خدمة التأمين لصيدليتك/, /للتواصل معنا/, /عايز تبدأ شغل من البيت/, /دخلت محل بيتزا/,
  /Automy Tech/, /Simplecodee/, /Everywheremarketing/, /WFH|فريلانس/,
]

async function main() {
  const since = new Date(Date.now() - 4 * 60 * 60 * 1000)
  const recent = await db.lead.findMany({
    where: { workspaceId: WS_ID, createdAt: { gte: since } },
    include: { business: { select: { id: true, name: true, city: true, phone: true } } },
  })
  console.log(`ليدز آخر 4 ساعات: ${recent.length}`)
  let stamped = 0, deleted = 0

  for (const l of recent) {
    const b = l.business
    if (!b) continue
    // حذف الضوضاء (اللي مالهاش تليفون = مش بيزنس حقيقي مطلوب)
    if (NOISE.some((re) => re.test(b.name)) && !b.phone) {
      await db.lead.delete({ where: { id: l.id } })
      await db.business.delete({ where: { id: b.id } }).catch(() => undefined)
      deleted++
      console.log(`  🗑 ضوضاء: ${b.name.slice(0, 55)}`)
      continue
    }
    // ختم المدينة من اسم البيزنس نفسه (فرع المعادي) أو خليها للهدف
    if (!b.city) {
      let city: string | null = null
      for (const [re, c] of CITY_HINTS) if (re.test(b.name)) { city = c; break }
      if (city) { await db.business.update({ where: { id: b.id }, data: { city } }); stamped++; continue }
    }
  }
  const total = await db.lead.count({ where: { workspaceId: WS_ID } })
  const maadi = await db.business.count({ where: { city: "المعادي" } })
  console.log(`\nنتيجة: حذف ${deleted} ضوضاء | ختم ${stamped} مدينة | الإجمالي ${total} | بيزنس المعادي: ${maadi}`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
