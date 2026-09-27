# LeadOS — إكمال سكيما الإنتاج: الموديلات السبعة الناقصة + back-relations + حقول AgentRun
# اللهجة: String عادية للأ.enums الجديدة (TEXT في بوستجرس) — Json للقوائم — علاقات بحذف متسلسل
import re

P = "prisma/schema.production.prisma"
s = open(P).read()

NEW_MODELS = """
 model Sequence {
   id             String   @id @default(cuid())
   workspaceId    String
   name           String
   description    String?
   kind           String   @default("NURTURE") // NURTURE | REACTIVATION | ONBOARD
   enabled        Boolean  @default(true)
   targetStatuses Json?    // string[] — حالات الليد المطلوب تجنيدها (فاضي = الكل)
   steps          SequenceStep[]
   enrollments    SequenceEnrollment[]
   createdAt      DateTime @default(now())
   updatedAt      DateTime @updatedAt

   workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

   @@index([workspaceId, enabled, kind])
 }

 model SequenceStep {
   id         String  @id @default(cuid())
   sequenceId String
   order      Int     @default(1)
   channel    String  @default("TASK") // TASK | WHATSAPP | EMAIL | MANUAL
   template   String
   waitHours  Int     @default(72)
   active     Boolean @default(true)

   sequence Sequence @relation(fields: [sequenceId], references: [id], onDelete: Cascade)

   @@index([sequenceId, order])
 }

 model SequenceEnrollment {
   id          String    @id @default(cuid())
   workspaceId String
   sequenceId  String
   leadId      String
   currentStep Int       @default(0)
   status      String    @default("ACTIVE") // ACTIVE | COMPLETED | PAUSED | CANCELLED
   nextStepAt  DateTime?
   lastStepAt  DateTime?
   createdAt   DateTime  @default(now())
   updatedAt   DateTime  @updatedAt

   sequence Sequence @relation(fields: [sequenceId], references: [id], onDelete: Cascade)
   lead     Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)

   @@unique([sequenceId, leadId])
   @@index([workspaceId, status, nextStepAt])
   @@index([leadId])
 }

 model AbExperiment {
   id          String   @id @default(cuid())
   workspaceId String
   name        String
   variants    Json     // [{ name, template, sent, replied, won }]
   status      String   @default("RUNNING") // RUNNING | DONE
   notes       String?
   createdAt   DateTime @default(now())
   updatedAt   DateTime @updatedAt

   workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

   @@index([workspaceId, status])
 }

 model EvolutionProposal {
   id           String    @id @default(cuid())
   workspaceId  String
   title        String
   kind         String
   rationale    String // ليه النظام شايف إن ده يستاهل؟
   plan         Json // خطة التطبيق اللي هتنفذ عند الموافقة ({ action: "config"|"noop", patch: {...} })
   impact       String? // الأثر المتوقع بالأرقام/الكلام
   status       String    @default("PENDING") // PENDING | APPROVED | REJECTED | APPLIED
   decisionNote String?
   decidedAt    DateTime?
   appliedAt    DateTime?
   createdAt    DateTime  @default(now())

   workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

   @@index([workspaceId, status, createdAt])
 }

 model PlatformAccount {
   id            String    @id @default(cuid())
   workspaceId   String
   platform      String    // WHATSAPP | FACEBOOK | INSTAGRAM | TELEGRAM | LINKEDIN | X
   handle        String
   label         String?
   status        String    @default("WARMING") // WARMING | ACTIVE | COOLDOWN | BLOCKED | DISABLED
   dailyLimit    Int       @default(20)
   sentToday     Int       @default(0)
   lastSentAt    DateTime?
   cooldownUntil DateTime?
   notes         String?
   createdAt     DateTime  @default(now())
   updatedAt     DateTime  @updatedAt

   workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

   @@unique([workspaceId, platform, handle])
   @@index([workspaceId, platform, status])
 }

 model TacticStat {
   id          String    @id @default(cuid())
   workspaceId String
   family      String // comment | reply | opener
   tacticId    String // معرف التكتيك (مثل comment:curiosity_information_gap)
   used        Int       @default(0)
   wins        Int       @default(0)
   weight      Float     @default(1.0) // الوزن المحسوب — أعلى = اختيار أكتر
   lastUsedAt  DateTime?
   lastWinAt   DateTime?
   createdAt   DateTime  @default(now())
   updatedAt   DateTime  @updatedAt

   workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

   @@unique([workspaceId, family, tacticId])
   @@index([workspaceId, family])
 }
"""

# 1) الموديلات السبعة — قبل الenum الأول
s = NEW_MODELS.lstrip("\n") + s

# 2) back-relations على Workspace
ws = re.search(r"(^\s*model Workspace \{.*?)(^\s*\})", s, re.M | re.S | re.I)
block = ws.group(0)
add = ""
for line, name in [
    ("  sequences          Sequence[]", "sequences"),
    ("  enrollments        SequenceEnrollment[]", None),
    ("  experiments        AbExperiment[]", "experiments"),
    ("  evolutionProposals EvolutionProposal[]", "evolutionProposals"),
    ("  platformAccounts   PlatformAccount[]", "platformAccounts"),
    ("  tacticStats        TacticStat[]", "tacticStats"),
]:
    if name and re.search(rf"^\s*{name}\s", block, re.M):
        continue
    add += line + "\n"
assert "sequences          Sequence[]" in add, "تحقق الإضافات"
new_block = block.replace("\n}", "\n" + add + "}")
s = s.replace(block, new_block, 1)

# 3) enrollments على Lead
lead = re.search(r"^\s*model Lead \{.*?^\s*\}", s, re.M | re.S)
lb = lead.group(0)
if not re.search(r"^\s*enrollments\s", lb, re.M):
    s = s.replace(lb, lb.replace("\n}", "\n  enrollments      SequenceEnrollment[]\n}"), 1)

# 4) حقول AgentRun
ar = re.search(r"^\s*model AgentRun \{.*?^\s*\}", s, re.M | re.S)
ab = ar.group(0)
adds = ""
for f in ["mode", "progress", "strategy"]:
    if not re.search(rf"^\s*{f}\s", ab, re.M):
        adds += "  " + f + "      String?\n"
if adds:
    s = s.replace(ab, ab.replace("\n}", "\n" + adds + "}"), 1)

open(P, "w").write(s)
import subprocess
n = len(set(re.findall(r"^\s*model (\w+)", s, re.M)))
print(f"✅ السكيما الاردية: {n} موديل")
