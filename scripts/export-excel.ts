// تصدير Excel فاخر — LeadOS CRM
// 3 أوراق: لوحة ملخص KPI + ليدز ساخنة + كل الليدز
// RTL كامل + ألوان سكور + أعمدة ذكية + تجميد رؤوس + فلاتر
import ExcelJS from "exceljs"
import { db } from "../src/lib/db"

const WS_ID = "cmtyimk8f0002oonlxid1k38p"
const OUT = process.env.EXPORT_DIR ?? "/home/z/my-project/download"

const C = {
  navy: "0F172A", slate: "1E293B", accent: "2563EB", gold: "F59E0B",
  green: "10B981", red: "EF4444", gray: "F1F5F9", white: "FFFFFF",
  hotFill: "DCFCE7", warmFill: "FEF9C3", coldFill: "FEE2E2",
}

const HEADERS = ["#", "الاسم", "الصناعة", "المدينة", "التليفون", "الإيميل", "الموقع", "التقييم", "المراجعات", "السكور", "النية", "المصدر", "الخلاصة", "أُضيف"]

async function styleHeader(row: ExcelJS.Row) {
  row.height = 26
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.navy } }
    cell.font = { bold: true, color: { argb: C.white }, size: 11, name: "Calibri" }
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
    cell.border = { bottom: { style: "thin", color: { argb: C.accent } } }
  })
}

function scoreFill(score: number) {
  if (score >= 70) return C.hotFill
  if (score >= 45) return C.warmFill
  return C.coldFill
}

function scoreFontColor(score: number) {
  if (score >= 70) return C.green
  if (score >= 45) return "B45309"
  return C.red
}

function leadRow(ws: ExcelJS.Worksheet, i: number, l: LeadRow, isNew: boolean) {
  const row = ws.addRow([
    i, l.name + (isNew ? "  ★ جديد" : ""), l.industry ?? "—", l.city ?? "—",
    l.phone ?? "—", l.email ?? "—", l.website ?? "—",
    l.rating ?? "—", l.reviews ?? "—", l.score, l.intent, l.source, (l.summary ?? "").slice(0, 160), l.added,
  ])
  row.height = 20
  row.eachCell((cell, col) => {
    cell.alignment = { vertical: "middle", horizontal: col === 2 || col === 13 ? "right" : "center", wrapText: col === 13 }
    cell.border = { bottom: { style: "hair", color: { argb: "CBD5E1" } } }
    if (i % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.gray } }
    if (col === 2) cell.font = { bold: true, size: 10, color: { argb: C.slate } }
    if (col === 5 || col === 6) cell.font = { size: 10, color: { argb: C.accent } }
    if (col === 7) { cell.font = { size: 9, color: { argb: "64748B" } }; cell.alignment.horizontal = "left" }
    if (col === 10) {
      cell.font = { bold: true, size: 11, color: { argb: scoreFontColor(l.score) } }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: scoreFill(l.score) } }
    }
  })
  // ★ جديد بالذهبي
  const nameCell = row.getCell(2)
  if (isNew) nameCell.font = { bold: true, size: 10, color: { argb: C.gold } }
  return row
}

interface LeadRow { name: string; industry: string | null; city: string | null; phone: string | null; email: string | null; website: string | null; rating: number | null; reviews: number | null; score: number; intent: string; source: string; summary: string | null; added: string; addedAt: string }

async function main() {
  const wb = new ExcelJS.Workbook()
  wb.creator = "LeadOS AI Agent"
  wb.created = new Date()

  const leads = await db.lead.findMany({
    where: { workspaceId: WS_ID },
    include: { business: { select: { name: true, phone: true, email: true, websiteUrl: true, city: true, industry: true, rating: true, reviewCount: true } } },
    orderBy: { score: "desc" },
  })
  // علامة "جديد" = كل صيدية جلسة التشغيل دي (آخر 3 ساعات)
  const freshCutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

  const rows: LeadRow[] = leads.map((l) => ({
    name: l.business?.name ?? "—",
    industry: l.business?.industry ?? null,
    city: l.business?.city ?? null,
    phone: l.business?.phone ?? null,
    email: l.business?.email ?? null,
    website: l.business?.websiteUrl ?? null,
    rating: l.business?.rating ?? null,
    reviews: l.business?.reviewCount ?? null,
    score: l.score, intent: l.intent, source: l.leadSourceType,
    summary: l.summary, added: l.createdAt.toISOString().slice(0, 10), addedAt: l.createdAt.toISOString(),
  }))
  const isToday = (r: LeadRow) => r.addedAt >= freshCutoff

  // ═══ ورقة 1: لوحة الملخص ═══
  const dash = wb.addWorksheet("لوحة الملخص", { views: [{ rightToLeft: true, showGridLines: false }] })
  dash.columns = [{ width: 3 }, { width: 34 }, { width: 16 }, { width: 16 }, { width: 46 }]
  dash.mergeCells("B2:E2")
  const title = dash.getCell("B2")
  title.value = "LeadOS — تقرير الليدز المولّدة بالذكاء الاصطناعي"
  title.font = { bold: true, size: 18, color: { argb: C.white }, name: "Calibri" }
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.navy } }
  title.alignment = { vertical: "middle", horizontal: "right" }
  dash.getRow(2).height = 40
  dash.mergeCells("B3:E3")
  const sub = dash.getCell("B3")
  sub.value = `صيد حي بالأيجنت الداخلي (خرائط جوجل + بحث متعدد المزودين) — ${new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`
  sub.font = { size: 11, color: { argb: C.white }, italic: true }
  sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.slate } }
  sub.alignment = { vertical: "middle", horizontal: "right" }
  dash.getRow(3).height = 24

  const kpi = (label: string, value: string | number, color: string, r: number) => {
    dash.mergeCells(`B${r}:C${r}`)
    const lv = dash.getCell(`B${r}`)
    lv.value = label
    lv.font = { size: 12, bold: true, color: { argb: C.slate } }
    lv.alignment = { horizontal: "right" }
    dash.getCell(`D${r}`).value = value
    const vc = dash.getCell(`D${r}`)
    vc.font = { size: 14, bold: true, color: { argb: color } }
    vc.alignment = { horizontal: "center" }
    vc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.gray } }
    dash.getRow(r).height = 22
  }

  const withPhone = rows.filter((r) => r.phone).length
  const withEmail = rows.filter((r) => r.email).length
  const withWeb = rows.filter((r) => r.website && r.website !== "—").length
  const hot = rows.filter((r) => r.score >= 70).length
  const warm = rows.filter((r) => r.score >= 45 && r.score < 70).length
  const cold = rows.filter((r) => r.score < 45).length
  const newToday = rows.filter(isToday).length
  const bySource = new Map<string, number>()
  for (const r of rows) bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1)

  kpi("إجمالي الليدز في CRM", rows.length, C.accent, 5)
  kpi(`صيد آخر 3 ساعات (جلسة النهارده)`, newToday, C.gold, 6)
  kpi("ليدز فيها تليفون مباشر", withPhone, C.green, 7)
  kpi("ليدز فيها إيميل", withEmail, C.green, 8)
  kpi("ليدز فيها موقع إلكتروني", withWeb, C.green, 9)
  kpi("ساخنة (سكور ≥ 70)", hot, C.green, 10)
  kpi("دافئة (45–69)", warm, "B45309", 11)
  kpi("باردة (< 45)", cold, C.red, 12)

  dash.getCell("B14").value = "التوزيع حسب المصدر"
  dash.getCell("B14").font = { bold: true, size: 13, color: { argb: C.navy } }
  let r = 15
  const sourceAr: Record<string, string> = {
    GOOGLE_MAPS: "خرائط جوجل", GOOGLE_SEARCH: "بحث جوجل", DIRECTORY: "أدلة الأعمال", NEWS: "أخبار",
    FACEBOOK: "فيسبوك", INSTAGRAM: "انستجرام", LINKEDIN: "لينكدإن", YOUTUBE: "يوتيوب", TIKTOK: "تيك توك",
    X: "X (تويتر)", REDDIT: "ريديت", WEBSITE: "مواقع/وظايف", DISCOVERY: "اكتشاف عام", SOCIAL: "سوشيال",
  }
  for (const [src, count] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
    dash.mergeCells(`B${r}:C${r}`)
    dash.getCell(`B${r}`).value = sourceAr[src] ?? src
    dash.getCell(`B${r}`).alignment = { horizontal: "right" }
    dash.getCell(`D${r}`).value = count
    dash.getCell(`D${r}`).alignment = { horizontal: "center" }
    dash.getCell(`D${r}`).font = { bold: true, color: { argb: C.accent } }
    // شريط نسبي
    const pct = count / rows.length
    dash.getCell(`E${r}`).value = "█".repeat(Math.max(1, Math.round(pct * 30))) + ` ${Math.round(pct * 100)}%`
    dash.getCell(`E${r}`).font = { color: { argb: C.accent }, size: 9 }
    r++
  }
  dash.getCell(`B${r + 1}`).value = "الخلاصة: الأيجنت الداخلي يصيد من 12 مصدرًا مع ذاكرة بحث (استعلام مكرر = رد فوري بدون ويب) وفلتر AI للضوضاء."
  dash.getCell(`B${r + 1}`).font = { italic: true, size: 10, color: { argb: "64748B" } }
  dash.mergeCells(`B${r + 1}:E${r + 1}`)
  dash.getCell(`B${r + 1}`).alignment = { horizontal: "right" }

  // ═══ ورقة 2 + 3: الليدز ═══
  const WIDTHS = [5, 30, 14, 13, 17, 26, 30, 8, 10, 8, 11, 15, 50, 11]
  const makeSheet = (name: string, data: LeadRow[], markNew: boolean) => {
    const ws = wb.addWorksheet(name, { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] })
    ws.columns = WIDTHS.map((w) => ({ width: w }))
    styleHeader(ws.addRow(HEADERS))
    data.forEach((row, i) => leadRow(ws, i + 1, row, markNew && isToday(row)))
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADERS.length } }
    return ws
  }

  makeSheet("ليدز ساخنة", rows.filter((r) => r.score >= 60), true)
  makeSheet("كل الليدز", rows, true)

  const filename = `LeadOS-ليدز-${new Date().toISOString().slice(0, 10)}.xlsx`
  await wb.xlsx.writeFile(`${OUT}/${filename}`)
  console.log(`✓ Excel saved: ${OUT}/${filename}`)
  console.log(`  كل الليدز: ${rows.length} | ساخنة(≥60): ${rows.filter((r) => r.score >= 60).length} | جديدة النهارده: ${newToday} | بتليفون: ${withPhone} | بإيميل: ${withEmail}`)
  process.exit(0)
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1) })
