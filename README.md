# LeadOS — منصة ذكاء العملاء المحتملين (AI Lead Intelligence Platform)

نظام SaaS يعمل 24/7 لاكتشاف العملاء المحتملين من الويب وخرائط جوجل والسوشيال، يحللهم بالذكاء الاصطناعي، يجري بحثًا عميقًا لكل Lead مهم، ويدير دورة البيع كاملة من أول اكتشاف حتى الإغلاق — كل ده من لوحة تحكم واحدة.

**مبني على**: Next.js 16 + TypeScript + Prisma + Tailwind 4 + shadcn/ui + Recharts — واجهة عربية RTL بالكامل.

---

## المزايا المنفذة (MVP كامل حسب وثيقة المشروع §73)

| # | الوحدة | الحالة |
|---|--------|--------|
| 1 | Dashboard (KPIs + تنبيهات + صحة المصادر) | ✓ |
| 2 | Auth (تسجيل دخول/إنشاء حساب + JWT cookie) | ✓ |
| 3 | Sources (6 مصادر + تشغيل/إيقاف + صحة) | ✓ |
| 4 | Rules (قواعد بحث + Query Expansion + استثناءات) | ✓ |
| 5 | Discovery (ويب + خرائط جوجل + محرك عينات) | ✓ |
| 6 | AI Classification (Mistral أو مزود مدمج + Heuristic Layer 1) | ✓ |
| 7 | Deduplication (هاتف/دومين/PlaceID/تشابه اسم) | ✓ |
| 8 | Lead Scoring (0-100 بسبعة مكونات + حرارة HOT/WARM/COLD) | ✓ |
| 9 | CRM Pipeline (كانبان بالسحب والإفلات + 10 مراحل) | ✓ |
| 10 | Google Places Adapter (جاهز — يحتاج مفتاح فقط) | ✓ |
| 11 | Deep Research (7 مراحل + Findings + Evidence + فرص) | ✓ |
| 12 | AI Commander (شات بأدوات: بحث CRM/قواعد/مهام/أبحاث) | ✓ |
| 13 | Alerts + Tasks + Analytics + Live Feed | ✓ |

**ملاحظة هندسية**: بدل Redis والـWorkers المنفصلة، الطابور هو جدول `Job` في قاعدة البيانات نفسها — نقطة `/api/cron/tick` بتتنادى كل 5 دقايق فتشغّل دورة: جدولة القواعد → اكتشاف → تطبيع → منع تكرار → تصنيف → scoring → بحث عميق للـHOT → تنبيهات. نفس سيناريو الوثيقة §70 لكن بيشتغل على استضافة مجانية.

---

## حسابات الدخول التجريبية (بعد الـSeed)

| الحساب | البريد | كلمة المرور | الدور |
|--------|--------|-------------|-------|
| أحمد المدير | `admin@leados.ai` | `123456` | OWNER |
| سارة مندوبة | `sara@leados.ai` | `123456` | AGENT |

---

## التشغيل المحلي (localhost)

```bash
bun install
bun run db:push        # إنشاء قاعدة SQLite
bun run scripts/seed.ts # بيانات ديمو مصرية غنية
bun run dev            # http://localhost:3000
```

---

## النشر المجاني 24/7 (Vercel + Neon + cron-job.org)

### الخطوة 1 — قاعدة البيانات المجانية (Neon)
1. سجّل دخول على **[neon.tech](https://neon.tech)** بحساب جوجل — **بدون كارت**.
2. أنشئ Project جديد → انسخ **Connection String** (`postgresql://...neon.tech/neondb?sslmode=require`).
3. احتفظ بيه — هتحتاجه في الخطوة 3.

### الخطوة 2 — ارفع الكود على GitHub
```bash
git init && git add . && git commit -m "LeadOS v1"
# أنشئ repo جديد على github.com ثم:
git remote add origin https://github.com/USERNAME/leados.git
git push -u origin main
```

### الخطوة 3 — انشر على Vercel
1. سجّل دخول **[vercel.com](https://vercel.com)** بحساب GitHub — **بدون كارت**.
2. **Add New → Project →** اختر الـrepo → Import.
3. في **Environment Variables** أضف:
   - `DATABASE_URL` = رابط Neon من الخطوة 1
   - `AUTH_SECRET` = أي نص عشوائي طويل (`openssl rand -hex 32`)
   - `CRON_SECRET` = نص عشوائي تاني (اختياري لكن مستحسن)
   - `MISTRAL_API_KEY` = مفتاحك من [console.mistral.ai](https://console.mistral.ai) (اختياري — بدون كارت، خطة Experiment المجانية)
   - `GOOGLE_MAPS_API_KEY` = (اختياري — محتاج تفعيل Billing في جوجل)
4. اضغط **Deploy** واستنى الدومين: `your-app.vercel.app`.

### الخطوة 4 — بدّل المخطط لنسخة PostgreSQL (مهم!)
المشروع شغال محليًا بـSQLite للتجربة، وللنشر على Neon استخدم مخططك الأصلي:
```bash
# محليًا قبل الرفع أو بعد أول Deploy:
DATABASE_URL="رابط-Neon" bunx prisma db push --schema prisma/schema.production.prisma
# ثم أنشئ أول مستخدم من صفحة تسجيل الدخول (حساب جديد)
```
> مخطط الإنتاج `prisma/schema.production.prisma` هو نفس مخططك الأصلي PostgreSQL بالكامل (Enums + Arrays + Decimal).

### الخطوة 5 — شغّل دورة الاكتشاف 24/7 (cron-job.org)
1. سجّل دخول **[cron-job.org](https://cron-job.org)** مجانًا.
2. **Cronjobs → Create cronjob**:
   - URL: `https://your-app.vercel.app/api/cron/tick?max=5`
   - كل **5 دقائق**
   - Headers: `x-cron-secret` = نفس قيمة `CRON_SECRET`
3. فعّل الـjob — **خلاص، النظام بقى يعمل 24/7**.

> ملاحظة: `vercel.json` فيه cron مدمج كل 5 دقايق، لكن خطة Vercel المجانية بتقيد Cron بحد أدنى يومي — عشان كده cron-job.org هو الحل المجاني الفعلي للتكرار كل 5 دقايق.

### الخطوة 6 — أول تسجيل دخول
1. افتح `your-app.vercel.app` → **حساب جديد** → أنشئ حسابك واسم مساحة عملك.
2. شاشة القواعد → فعّل/أنشئ قاعدة بحث.
3. اضغط **"تشغيل دورة اكتشاف"** من الشريط العلوي — أو استنى cron 5 دقايق.
4. تابع الـLeads تظهر في البث المباشر → اضغط **بحث عميق** → اتابع في مركز الأبحاث.

---

## بنية المشروع

```
src/
  lib/                  محرك النظام
    ai.ts               AI Provider: Mistral → z-ai مدمج → null
    classification.ts   تصنيف AI + Heuristic Layer (كلمات مفتاحية)
    scoring.ts          محرك Score (7 مكونات) + تنبيهات HOT
    dedup.ts            منع التكرار (هاتف/دومين/PlaceID/اسم)
    discovery.ts        Adapters: ويب/خرائط جوجل + site: لكل المنصات + Query Expansion
    research.ts         Deep Research: 7 مراحل بـEvidence
    queue.ts            طابور DB + Scheduler + Retry/Backoff + ingest مشترك
    chat-tools.ts       أدوات AI Commander (9 أدوات محددة الصلاحيات)
    auth.ts             scrypt + JWT + جلسات httpOnly
    constants.ts        كل الـEnums بعناوين عربية
  app/api/              21 نقطة API (leads/pipeline/research/rules/ingest/webhook/...)
  components/leados/    الواجهة (Shell + 12 شاشة)
prisma/
  schema.prisma         نسخة SQLite (تطوير)
  schema.production.prisma نسخة PostgreSQL الأصلية (إنتاج على Neon)
scripts/seed.ts         بيانات ديمو
vercel.json             إعدادات النشر
worker/                 Worker مفتوح المصدر (Botasaurus) يغذي النظام 24/7 — التفاصيل في worker/README-ar.md
```

## الـWorker المفتوح المصدر (تغذية 24/7 من خرائط وفيسبوك بأسماء وتليفونات حقيقية)

LeadOS يقدر يشتغل لوحده (اكتشاف داخلي بـweb search)، ومعاه **Worker** مفتوح المصدر مبني على Botasaurus يشتغل دائمًا على VPS/Railway (أو مجانًا كل 6 ساعات على GitHub Actions) ويبعت النتايج تلقائيًا لـ`/api/ingest/webhook` — نفس التصنيف ومنع التكرار والتقييم والبحث العميق.

```bash
# أسرع بداية (VPS):
cd worker && cp .env.example .env   # عبّي LEADOS_BASE_URL + LEADOS_API_KEY (نفس INGEST_API_KEY في Vercel)
docker compose up -d
```

الميزانيات اليومية وقواطع منع الحظر والفواصل البشرية والدوران — كلها مضبوطة في `worker/config.yaml`. الدليل الكامل: **worker/README-ar.md**

## إخلاء مسؤولية تشغيلي (من وثيقة المشروع §55)
النظام مصمم للعمل مع المصادر والواجهات **المسموح بها** فقط — لا يتضمن تجاوز CAPTCHA أو Rate Limits أو حمايات المنصات. الـAutomation الخارجية تعتمد على القنوات التي تسمح بها الجهة المالكة للمصدر، والـWorker يحترم ميزانيات صارمة وقواطع حظر تلقائية.
