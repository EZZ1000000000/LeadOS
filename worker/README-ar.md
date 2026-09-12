# LeadOS Worker — ووركر مفتوح المصدر يعمل 24/7 ويغذي LeadOS تلقائيًا

ووركر استكشاف عملاء حقيقي مبني على **[Botasaurus](https://github.com/omkar-cloud/botasaurus)** (مفتوح المصدر، Apache-2.0) — يكتشف أعمالًا مصرية حقيقية من Google Maps وفيسبوك وانستجرام ولينكدإن والأدلة، ويبعتهم تلقائيًا لـLeadOS عبر `/api/ingest/webhook` حيث يمرّون بنفس الـpipeline الداخلي (تصنيف → منع تكرار → تقييم → بحث عميق للـHot Leads).

```
┌─────────────────────┐         webhook         ┌──────────────────────────┐
│  LeadOS Worker      │  POST /api/ingest/      │  LeadOS (Vercel مجاني)   │
│  Botasaurus         │  webhook + x-api-key    │  تصنيف → dedup → تقييم   │
│  VPS/Railway/GH     │  ────────────────────▶  │  → Leads جاهزة للفريق    │
└─────────────────────┘                         └──────────────────────────┘
```

## الملفات

| ملف | الوظيفة |
|-----|---------|
| `bot.py` | مهام الـscraping (خرائط + بحث عام + فيسبوك بالكوكيز) وأوامر التشغيل |
| `guard.py` | 🛡️ التنظيم الذكي: ميزانيات يومية، قواطع دائرة، فواصل بشرية، دوران استعلامات |
| `leados_client.py` | إرسال النتايج لـLeadOS مع retry/backoff على دفعات |
| `config.yaml` | كل الإعدادات: استعلامات، ميزانيات، تأخيرات، بروكسي |
| `Dockerfile` + `docker-compose.yml` | نشر بأمر واحد على VPS/Railway |
| `run.sh` | تشغيل سريع بدون Docker |

## ربط الـWorker بـLeadOS (مرة واحدة)

1. في Vercel → تطبيق LeadOS → Settings → Environment Variables أضف:
   ```
   INGEST_API_KEY=<openssl rand -hex 16>
   ```
2. في `worker/.env` (محلي) أو متغيرات البيئة على الاستضافة:
   ```
   LEADOS_BASE_URL=https://your-leados.vercel.app
   LEADOS_API_KEY=<نفس القيمة>
   ```
3. اختبر الاتصال:
   ```bash
   python bot.py health   # ✅ الاتصال شغال والمفتاح مقبول
   ```

## خيارات النشر الدائم

| الخيار | التكلفة | الأنسب لـ | ملاحظات |
|--------|---------|-----------|---------|
| **VPS** (Hetzner CX22 / Contabo) | ~€4.5/شهر | 🥇 كل المنصات + كوكيز فيسبوك + بروكسي | تحكم كامل، `docker compose up -d` وخلاص |
| **Railway** | ~$5/شهر | 🥈 كل المنصات بدون تعامل مع سيرفر | ارفع المجلد على GitHub → Deploy from repo |
| **GitHub Actions** | مجاني | 🥉 خرائط + بحث عام (بدون كوكيز) | كل 6 ساعات تلقائيًا — ملف `.github/workflows/worker.yml` جاهز |
| Vercel | ❌ | — | سيرفرليس ممنوع فيه متصفح دائم — الـWorker يحتاج حاوية مستمرة، أما LeadOS نفسه فيشتغل على Vercel تمامًا |

### النشر على VPS (الموصى به)

```bash
# على السيرفر بعد تثبيت docker
git clone <repo> && cd <repo>/worker
cp .env.example .env    # عبّي LEADOS_BASE_URL و LEADOS_API_KEY
docker compose up -d    # تشغيل دائم — يعيد الدورة كل 3 ساعات تلقائيًا
docker logs -f leados-worker  # متابعة السجلات
```

### النشر على Railway

1. ارفع المشروع على GitHub → railway.app → New Project → Deploy from GitHub repo
2. Root Directory = `worker` (Railway يكتشف Dockerfile تلقائيًا)
3. Variables: `LEADOS_BASE_URL` و `LEADOS_API_KEY` و `WORKER_MODE=loop`

### النشر على GitHub Actions (مجاني)

1. ارفع المشروع على GitHub
2. Settings → Secrets and variables → Actions → أضف `LEADOS_BASE_URL` و `LEADOS_API_KEY`
3. الـworkflow الجاهز `.github/workflows/worker.yml` هيشتغل كل 6 ساعات (خرائط + بحث عام؛ فيسبوك معطّل تلقائيًا لأن IP جوجل داتا سنتر)

## الكوكيز (الجلسات المسجلة)

- **الألية:** Botasaurus يحفظ بروفايل متصفح لكل منصة في `profiles/` — الجلسة تعيش بين الدورات تلقائيًا.
- **تسجيل دخول فيسبوك يدوي (مرة واحدة):**
  ```bash
  python bot.py login facebook   # نافذة مرئية → سجّل دخول → اضغط Enter
  ```
  الكوكيز تُحفظ في `state/facebook_cookies.json` وتُستخدم لفتح صفحات فيسبوك واستخراج التليفونات.
- على VPS بلا واجهة: سجّل دخول على جهازك المحلي ثم ارفع مجلد `profiles/` و `state/` للسيرفر.
- **أمان:** لا ترفع ملفات الكوكيز على GitHub أبدًا (مضافة لـ`.gitignore`).

## 🛡️ التنظيم الذكي المانع للحظر (guard.py)

| الآلية | التفاصيل |
|--------|----------|
| ميزانيات يومية | خرائط 60/يوم، فيسبوك 20، انستجرام 20، لينكدإن 15، أدلة 20 |
| Circuit breaker | أول إشارة bot-detection → المنصة تُقفل لباقي اليوم تلقائيًا |
| فواصل بشرية | 3–8 ثواني بين الصفحات، 8–25 ثانية بين الاستعلامات، سكرول متقطع — كلها بعشوائية |
| دوران استعلامات | كل دورة تكمل من حيث توقفت — لا تكرار نمط محسوس |
| بروفايل ثابت لكل منصة | نفس البصمة والكوكيز دايمًا — التغيير المستمر يخطر الشك |
| بروكسي سكني (اختياري) | ضع `WORKER_PROXY=http://user:pass@host:port` — ثابت لنفس البروفايل |
| راحة احترازية | 3 دورات فارغة متتالية → راحة المنصة تلقائيًا |

راقب الحالة: `python bot.py status`

## تخصيص الاستعلامات

عدّل `config.yaml` → `queries` (أي منصة من: GOOGLE_MAPS, FACEBOOK, INSTAGRAM, LINKEDIN, DIRECTORY) وأضف استعلاماتك مثل `"صيدليات في الجيزة"`. كل استعلام تُكتشف منه أعمال حقيقية بأسمائها وتليفوناتها الفعلية.

## إخلاء مسؤولية

الـscraping قد يخالف شروط الخدمة لبعض المنصات. استخدم الـWorker للبيانات العامة والتجارية المعلنة، احترم الميزانيات، ولا تسحب بيانات شخصية غير تجارية. أنت مسؤول عن استخدامه وفق القوانين المحلية وشروط المنصات.
