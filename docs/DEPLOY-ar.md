# دليل نشر LeadOS مجاني 100%

## 1) التطبيق على Vercel (مجاني دائم)

1. ادخل [vercel.com](https://vercel.com) وسجّل بحساب GitHub بتاعك
2. **Add New → Project → Import** → اختار `LeadOS`
3. **قبل أول Deploy** — بدّل قاعدة البيانات من SQLite المحلي لـNeon (مجاني 0.5GB):
   - [neon.tech](https://neon.tech) → أنشئ مشروع → انسخ Connection String
   - **السكيما الإنتاجية تلقائية**: Vercel بيستخدم `vercel-build` اللي يولّد عميل Prisma من `prisma/schema.production.prisma` (PostgreSQL جاهزة بكل الموديلات بما فيها نظام الأيجنت) — مفيش أي تعديل يدوي في السكيما
   - حط `DATABASE_URL` في متغيرات Vercel = رابط Neon
   - شغّل `npx prisma db push --schema prisma/schema.production.prisma` محليًا على رابط Neon (هيبنى الجداول سحابيًا)
4. الصق متغيرات البيئة من `.env` المحلية (كلها في Settings → Environment Variables) — أهمها: `AUTH_SECRET` (عشوائي قوي جديد)، `CRON_SECRET`، `GEMINI_API_KEY`، مفاتيح البحث
5. Deploy — هيطلعلك رابط دائم `leados.vercel.app`

> ملاحظة: التطبيق مصمم بالكامل `String` enums و Json — التحويل لـPostgres سلس بدون تعديل كود. سكيما الإنتاج متحقق منها بـ`prisma validate` ومطابقة هيكليًا للديف 100% (سكريبت `scripts/diff-schemas.ts`).

## 2) المجدول (تيك كل 10 دقايق) — مجاني

- سجّل في [cron-job.org](https://cron-job.org) (مجاني بلا حدود)
- أنشئ Job: `GET https://YOUR-APP.vercel.app/api/cron/tick` كل 10 دقايق
- حط هيدر `x-cron-secret: <قيمة CRON_SECRET>` (تلاقيها في متغيرات البيئة)

## 3) الـWorker (المتصفح الآلي) — مجاني

- GitHub Actions جاهزة في الريبو: `.github/workflows/worker.yml`
- تتجري كل 6 ساعات على حساب GitHub (مجاني) — لكن **من IP داتا سنتر** (فيسبوك متعطل فيها تلقائيًا للحماية)
- للكوكيز والفيسبوك: VPS رخيص (~€4.5) أو Railway — `docker-compose up` من مجلد `worker/`

## 4) خريطة المفاتيح المجانية المتكررة

| الخدمة | المفتاح | الحصة المجانية | ليه |
|---|---|---|---|
| **Gemini** ⭐ | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | 1500 طلب/يوم | الشات + تصنيف الليدز (الأهم) |
| **Groq** | [console.groq.com/keys](https://console.groq.com/keys) | 14400 طلب/يوم | احتياطي AI أسرع صاروخ |
| **Tavily** | [tavily.com](https://tavily.com) | 1000 كريدت/شهر | البحث الدائم الأساسي |
| **SerpAPI** | [serpapi.com](https://serpapi.com) | 250 بحث/شهر | احتياطي بحث |
| **Mistral** | [console.mistral.ai](https://console.mistral.ai) | حصص صغيرة/مفتاح | الدوران بيضاعف السقف |
| **Neon** | [neon.tech](https://neon.tech) | 0.5GB قاعدة | قاعدة سحابية دائمة |
| **cron-job.org** | مجاني بلا مفتاح | بلا حدود | تيك المجدول |

> ⚠️ **ملاحظة Gemini المهمة**: مفتاح Gemini بيتمنطق حسب موقع **الخادم** اللي بيطلب الـAPI — على Vercel (خروج أمريكي) شغال 100%. لو شغّلت المشروع سيلف-هوست من منطقة محجوبة (مصر، هونج كونج، الصين) هترجع `User location is not supported` — النظام بيتراجل أوتوماتيك للتابع بدون أي كسر. موديل `gemini-2.0-flash` اتشال من Google — استخدم `gemini-2.5-flash` أو أحدث.

## 5) الاقتصاد المجاني الكامل

- **اكتشاف الليدز**: Tavily (1000/شهر) + SerpAPI (250/شهر) + ذاكرة البحث (استعلام مكرر = صفر تكلفة) = تدفق دائم
- **الذكاء**: Gemini يوميًا (45,000/شهر) يغطي الشات والتصنيف والبحث العميق
- **الاستضافة**: Vercel Hobby + Neon + cron-job = 0 جنيه
- **المراحل التالية (اختياري)**: Brevo (300 إيميل/يوم مجاني) للتواصل، Evolution API سيلف-هوست للواتساب
