// Task 19 — حقن وظيفة DISCOVERY اختبارية: FACEBOOK فقط (لتشغيل تعدين الجروبات فورًا)
import { PrismaClient } from "@prisma/client"
const url = (await import("fs")).readFileSync("/tmp/neon_url", "utf8").trim()
const db = new PrismaClient({ datasources: { db: { url } } })

try {
  // قاعدة الأجينسي (فيها FACEBOOK)
  const rule = await db.searchRule.findFirst({
    where: { enabled: true, name: { contains: "أجينسي" } },
    select: { id: true, workspaceId: true, name: true },
  })
  if (!rule) throw new Error("قاعدة الأجينسي مش موجودة")
  const source = await db.source.findFirst({ where: { workspaceId: rule.workspaceId, status: "ACTIVE" }, select: { id: true } })

  const job = await db.job.create({
    data: {
      workspaceId: rule.workspaceId,
      type: "DISCOVERY",
      status: "QUEUED",
      priority: 50,
      attempts: 0,
      maxAttempts: 2,
      payload: { ruleId: rule.id, sourceId: source?.id, sourceTypes: ["FACEBOOK"] },
      scheduledAt: new Date(),
    },
  })
  console.log("✅ تم حقن الوظيفة:", job.id, "للقاعدة:", rule.name, "— sourceTypes: [FACEBOOK]")
} finally { await db.$disconnect() }
