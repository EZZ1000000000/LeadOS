/**
 * مقارنة شاملة بين prisma/schema.prisma و db/custom.db الفعلية
 * يطبع: الأعمدة الناقصة من القاعدة + الجداول الناقصة
 */
import { Database } from "bun:sqlite";
import { readFileSync } from "fs";

const schemaPath = "prisma/schema.prisma";
const schemaContent = readFileSync(schemaPath, "utf-8");

// 1) قراءة الجداول والأعمدة من القاعدة الفعلية
const db = new Database("db/custom.db", { readonly: true });
const actualTables = db
  .query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
  .all()
  .map((r: any) => r.name);

const actualColumns: Record<string, string[]> = {};
for (const t of actualTables) {
  actualColumns[t] = db.query(`PRAGMA table_info('${t}')`).all().map((c: any) => c.name);
}

// 2) parse الـ Prisma schema: كتل model { ... }
const modelBlocks: Record<string, string[]> = {};
const modelRegex = /model\s+(\w+)\s*\{([^}]*)\}/g;
let m: RegExpExecArray | null;
while ((m = modelRegex.exec(schemaContent)) !== null) {
  const modelName = m[1];
  const body = m[2];
  const cols: string[] = [];
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("@@")) continue;
    const fieldMatch = /^(\w+)\s+([\w\[\]]+)/.exec(trimmed);
    if (!fieldMatch) continue;
    const [, fieldName, fieldType] = fieldMatch;
    // حقول العلاقات (Business، Person...) مش أعمدة فعلية
    if (fieldType === "Business" || fieldType === "Person" || fieldType === "Workspace" ||
        fieldType === "User" || fieldType === "Lead" || fieldType === "Source" ||
        fieldType === "SearchRule" || fieldType === "Deal" || fieldType === "Pipeline" ||
        fieldType === "PipelineStage" || fieldType === "Tag" || fieldType === "ContactList" ||
        fieldType === "ContentItem" || fieldType === "Website" || fieldType === "Branch" ||
        fieldType === "AgentRun" || fieldType === "SavedView" || fieldType === "SocialProfile" ||
        fieldType === "Review" || fieldType === "WebsitePage" || fieldType === "Finding" ||
        fieldType === "Opportunity" || fieldType === "Note" || fieldType === "Competitor" ||
        fieldType === "Task" || fieldType === "Activity" || fieldType === "AuditLog" ||
        fieldType === "Job" || fieldType === "Automation" || fieldType === "Alert" ||
        fieldType === "WorkspaceMember" || fieldType === "SearchJob" ||
        fieldType === "BusinessSource" || fieldType === "LeadSource" || fieldType === "LeadTag" ||
        fieldType === "LeadContent" || fieldType === "ResearchRun" || fieldType === "AiProviderConfig" ||
        fieldType === "AiRun" || fieldType === "AiChatSession" || fieldType === "AiChatMessage" ||
        fieldType === "SearchMemory" || fieldType === "AgentInsight") continue;
    if (fieldName === "id" || ["createdAt","updatedAt"].includes(fieldName)) continue; // دي موجودة غالباً
    cols.push(fieldName);
  }
  modelBlocks[modelName] = cols;
}

// 3) المطابقة: model → جدول بنفس الاسم
console.log("═".repeat(60));
console.log("فحص انحراف الـSchema (Prisma ⇆ SQLite الفعلية)");
console.log("═".repeat(60));

let issues = 0;
const missingTables: string[] = [];

for (const [model, cols] of Object.entries(modelBlocks)) {
  if (!actualTables.includes(model)) {
    missingTables.push(model);
    continue;
  }
  const actual = actualColumns[model] || [];
  const missing = cols.filter((c) => !actual.includes(c));
  if (missing.length > 0) {
    console.log(`\n❌ ${model}: ناقص ${missing.length} عمود → ${missing.join(", ")}`);
    issues++;
  }
}

if (missingTables.length > 0) {
  console.log(`\n⚠️  جداول مش موجودة في القاعدة: ${missingTables.join(", ")}`);
  issues++;
}

if (issues === 0) {
  console.log("\n✅ مفيش أي انحراف — القاعدة مطابقة للـSchema بالكامل");
} else {
  console.log(`\n→ الإجمالي: ${issues} جدول فيه نقص — محتاج prisma db push`);
}
