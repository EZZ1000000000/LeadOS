// LeadOS — مزامنة إضافية فقط (ADDITIVE-ONLY) لقاعدة Neon الإنتاجية
// تطبق: قيم enums ناقصة يجب أن يعتمدها الكود المنشور. ممنوع منعًا باتًا: DROP / تحويل أعمدة.
// الاستخدام: DATABASE_URL=postgres://… bun run scripts/sync-neon-additive.ts
import { PrismaClient } from "@prisma/client"

const p = new PrismaClient()

async function enumHas(type: string, value: string): Promise<boolean> {
  const rows = await p.$queryRawUnsafe<{ v: string }[]>(
    `SELECT unnest(enum_range(NULL::"${type}")) as v`
  )
  return rows.some((r) => r.v === value)
}

async function addEnumValue(type: string, value: string) {
  if (await enumHas(type, value)) {
    console.log(`  = ${type}.${value} موجود مسبقًا`)
    return
  }
  // ALTER TYPE ADD VALUE لا يعمل داخل معاملة — $executeRawUnsafe ينفذ خارج معاملة صريحة
  await p.$executeRawUnsafe(`ALTER TYPE "${type}" ADD VALUE '${value}'`)
  console.log(`  + ${type}.${value} أُضيفت`)
}

async function tableExists(name: string): Promise<boolean> {
  const rows = await p.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT COUNT(*)::int as c FROM information_schema.tables WHERE table_schema='public' AND table_name='${name}'`
  )
  return Number(rows[0].c) > 0
}

async function main() {
  console.log("══ مزامنة إضافية آمنة — Neon الإنتاج ══")

  console.log("[1] قيم enums الناقصة (التي يعتمدها الكود المنشور):")
  await addEnumValue("JobStatus", "WAITING_FOR_CAPABILITY")
  await addEnumValue("AiProvider", "DAHL")
  await addEnumValue("AiProvider", "NVIDIA")
  await addEnumValue("AiRunType", "SKILL_QUERIES")
  await addEnumValue("AiRunType", "SKILL_SELECT")

  console.log("[2] جداول النظام الذاتية (يُفترض أن ينشئها التطبيق أول استخدام — نضمنها هنا):")
  for (const t of ["PlatformAccount", "SystemState"]) {
    console.log(`  ${t}: ${await tableExists(t) ? "موجود" : "غير موجود — سيُنشئه التطبيق ذاتيًا عند أول استدعاء /api/platforms"}`)
  }

  console.log("[3] ما لم يُمَس عمدًا (سياسة عدم التدمير):")
  console.log("  - أعمدة Lead.phone/phoneCountry/phoneSource (9 ليدات بها بيانات) — تبقى كما هي")
  console.log("  - جداول/أعمدة متأخرة أخرى (Sequence، Conversation.mode…) — تُراجع لاحقًا مع صاحب القرار")

  console.log("[4] تحقق نهائي:")
  const st = await p.$queryRawUnsafe<{ v: string }[]>('SELECT unnest(enum_range(NULL::"JobStatus")) as v')
  console.log("  JobStatus الآن:", st.map((s) => s.v).join(","))
  const ai = await p.$queryRawUnsafe<{ v: string }[]>('SELECT unnest(enum_range(NULL::"AiProvider")) as v')
  console.log("  AiProvider الآن:", ai.map((s) => s.v).join(","))
}

main()
  .catch((e) => {
    console.error("SYNC FAILED:", e instanceof Error ? e.message.slice(0, 300) : e)
    process.exit(1)
  })
  .finally(() => p.$disconnect())
