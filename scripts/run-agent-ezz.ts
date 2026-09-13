/**
 * تشغيل أيجنت حقيقي على مساحة المستخدم (ezz) — مجالاته:
 * 1) كافيهات شعبي وراقي — عملاء سستم كروت النت (خرائط + سوشيال)
 * 2) شركات محتاجة خدمات الأجينسي: مركتنج / سوفت وير / فوتو شوت (ويب + خرائط + لينكدإن)
 */
import { PrismaClient } from "@prisma/client"
import { runAgent } from "../src/lib/agent/loop"

const db = new PrismaClient()

function printSteps(steps: Array<{ idx: number; tool: string; note: string; status: string; durationMs: number }>) {
  for (const s of steps) {
    const icon = s.status === "OK" ? "✓" : s.status === "SKIPPED" ? "⏭" : "✗"
    console.log(`   ${icon} [${s.tool}] ${s.note} (${s.durationMs}ms)`)
  }
}

async function main() {
  const which = process.argv[2] ?? "both"
  const ws = await db.workspace.findFirst({ where: { slug: "ezz-abuijo" } })
  if (!ws) throw new Error("ezz workspace missing")
  const before = await db.lead.count({ where: { workspaceId: ws.id } })
  console.log(`# ezz workspace=${ws.id} | LEADS BEFORE=${before} | mode=${which}\n`)

  // ═══ تشغيل 1: كافيهات — سستم كروت النت ═══
  if (which === "both" || which === "cafes") {
  console.log("════ تشغيل 1: كافيهات شعبي وراقي (سستم كروت نت) ════")
  const r1 = await runAgent(
    ws.id,
    "كافيهات في القاهرة الجديدة ومدينة نصر والمعادي عايزة نظام كروت نت وواي فاي للزباين",
    { platforms: ["GOOGLE_MAPS", "GOOGLE_SEARCH", "FACEBOOK", "INSTAGRAM"] },
  )
  console.log(`STATUS=${r1.status} | ${r1.summary}`)
  printSteps(r1.steps)
  const after1 = await db.lead.count({ where: { workspaceId: ws.id } })
  console.log(`LEADS=${after1} (+${after1 - before})\n`)
  }

  // ═══ تشغيل 2: شركات محتاجة خدمات الأجينسي ═══
  if (which === "both" || which === "agency") {
  console.log("════ تشغيل 2: عملاء خدمات الأجينسي (مركتنج/سوفت وير/فوتو شوت) ════")
  const r2 = await runAgent(
    ws.id,
    "شركات ومطاعم وعيادات في القاهرة والجيزة محتاجة خدمات تسويق رقمي وسوشيال ميديا وتصوير فوتوغرافي وبرمجة",
    { platforms: ["GOOGLE_SEARCH", "GOOGLE_MAPS", "FACEBOOK", "LINKEDIN"] },
  )
  console.log(`STATUS=${r2.status} | ${r2.summary}`)
  printSteps(r2.steps)
  const after2 = await db.lead.count({ where: { workspaceId: ws.id } })
  console.log(`LEADS=${after2} (+${after2 - after1})`)
  }

  // ═══ عينة من الليدز الجديدة ═══
  const sample = await db.lead.findMany({
    where: { workspaceId: ws.id, createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
    include: { business: { select: { name: true, phone: true, city: true, industry: true, rating: true } } },
    orderBy: { score: "desc" },
    take: 12,
  })
  console.log("\n=== أحدث 12 ليد (بالسكور) ===")
  for (const l of sample) {
    console.log(`  [${l.score}] ${l.business?.name} | ${l.business?.industry ?? "-"} | ${l.business?.city ?? "-"} | ت:${l.business?.phone ?? "-"} | ${l.whyNow?.slice(0, 60) ?? ""}`)
  }
}

main().finally(() => db.$disconnect())
