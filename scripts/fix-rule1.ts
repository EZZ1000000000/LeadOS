import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const rule = await db.searchRule.findFirst({ where: { name: { contains: "إشارات مصر الحارة" } } });
if (rule) {
  await db.searchRule.update({
    where: { id: rule.id },
    data: { keywords: ['"محتاج مبرمج" مصر', '"عايز حد يعمل لي موقع"', '"محتاج نظام كاشير"', '"مطلوب شركة برمجة" مصر', '"عايز تطبيق لمشروعي"', '"محتاج برنامج محاسبة"'] },
  });
  console.log("✅ Rule 1 keywords cleaned");
} else console.log("rule not found");
await db.$disconnect();
