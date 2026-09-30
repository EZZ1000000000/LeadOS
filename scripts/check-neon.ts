// LeadOS — فحص Neon الخام: بيانات التليفونات + قيم الـ enums الحالية
// الاستخدام: DATABASE_URL=postgres://… bun run scripts/check-neon.ts
import { PrismaClient } from "@prisma/client"

const p = new PrismaClient()

async function main() {
  const phones = await p.$queryRawUnsafe<{ c: number }[]>(
    'SELECT COUNT(*)::int as c FROM "Lead" WHERE "phone" IS NOT NULL'
  )
  console.log("leads with phone data:", phones[0].c)

  const cols = await p.$queryRawUnsafe<{ column_name: string }[]>(
    "SELECT column_name FROM information_schema.columns WHERE table_name='Lead' AND column_name LIKE '%phone%'"
  )
  console.log("phone-ish columns on Lead:", cols.map((c) => c.column_name).join(",") || "NONE")

  const st = await p.$queryRawUnsafe<{ v: string }[]>(
    'SELECT unnest(enum_range(NULL::"JobStatus")) as v'
  )
  console.log("JobStatus enum:", st.map((s) => s.v).join(","))

  const ai = await p.$queryRawUnsafe<{ v: string }[]>(
    'SELECT unnest(enum_range(NULL::"AiProvider")) as v'
  )
  console.log("AiProvider enum:", ai.map((s) => s.v).join(","))

  const tables = await p.$queryRawUnsafe<{ table_name: string }[]>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  )
  console.log("tables:", tables.map((t) => t.table_name).join(","))
}

main()
  .catch((e) => {
    console.error("CHECK FAILED:", e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => p.$disconnect())
