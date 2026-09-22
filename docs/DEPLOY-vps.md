# LeadOS — دليل النشر الكامل على استضافة حقيقية

> **الهدف**: نقل المشروع من البيئة المؤقتة (sandbox بتعمل reset وبتضيع البيانات) لسيرفر حقيقي دائم — البيانات عمرها ما تضيع تاني.

---

## 1) مقارنة الاستضافات — إيه الأنسب لمشروعنا؟

مشهنا بيعتمد على 3 حاجات: **قاعدة SQLite ملف محلي + حلقات خلفية دايمة (نبضة/مشرف/باك أب) + سكربتات bash**. ده معناه إننا محتاجين **سيرفر كامل (VPS)** مش serverless.

| الاستضافة | التكلفة | مناسب لينا؟ | ليه |
|---|---|---|---|
| **Oracle Cloud Always Free** ⭐⭐⭐ | **0 جنيه للأبد** | ✅ الأفضل مجاناً | VPS حقيقي ARM بـ4 أنوية + **24GB RAM + 200GB قرص** — أقوى حصة مجانية في السوق، بلا انتهاء مدة |
| **Hetzner CX22** ⭐ | ~4.5€/شهر | ✅ الأفضل مدفوعاً | 2 vCPU + 4GB RAM أوروبية سريعة، موثوقة جداً |
| **Hostinger KVM2** | ~$3.5-5/شهر | ✅ | 2 vCPU + 8GB RAM — أرخص جيجابايت |
| **Contabo VPS S** | ~€5/شهر | ✅ | 4 vCPU + 8GB RAM — أقصى عتاد بالفلوس دي |
| **DigitalOcean / Vultr** | $6/شهر | ✅ | واجهات مريحة، مراكز بيانات كتير |
| **Railway** | ~$5/شهر | ⚠️ ينفع | Docker + volumes — بس أغلى من VPS لنفس العتاد |
| **Fly.io** | ~$3-6/شهر | ⚠️ ينفع | volumes دائمة — إعداد Docker نفسه |
| **Vercel (مجاني)** | 0 | ❌ بمكانه الحالي | Serverless: مفيش process دايمة للحلقات + ملفات مش دائمة (شوف مسار بديل تحت) |
| **Render (مجاني)** | 0 | ❌ | السيرفر بينام بعد 15 دقيقة سكون |
| **Google Cloud e2-micro (مجاني)** | 0 | ❌ ضعيف | 1GB RAM مش كفاية للبناء والتشغيل المريح |
| **AWS Free Tier** | 0 لـ12 شهر | ❌ مؤقت | 1GB RAM + تنتهي بعد سنة + تعقيد فواتير |

**الخلاصة**: 
- عايز **مجاني للأبد بلا تنازل** → Oracle Cloud Always Free
- عايز **أرخص مدفوع مضمون** → Hetzner أو Hostinger (~5$)
- عايز **سحابة 100% مجانية بدون VPS** → مسار Vercel+Neon+cron-job (بترحيل بسيط للقاعدة — الدليل القديم `docs/DEPLOY-ar.md` بيعمله، وفيه `prisma/schema.production.prisma` جاهز لـPostgres)

---

## 2) التوصية الأولى: Oracle Cloud Always Free (مجاني للأبد)

### ليه Oracle بالذات؟
- **4 أنوية ARM Ampere + 24GB RAM + 200GB قرص — مجاني للأبد (Always Free مش Trial)**
- VPS حقيقي بـUbuntu → مشروعنا ينقل **حرفياً بدون تعديل سطر واحد**
- الـreset مش موجود — السيرفر بيفضل شغال سنين

### الخطوات (15 دقيقة):
1. [cloud.oracle.com](https://cloud.oracle.com) → **Start for free**
2. التسجيل محتاج **بطاقة بنكية للتحقق** (مش بتتخصم — بس للهوية، وممكن virtual بطاقة)
   > 💡 لو رفض التسجيل (بيحصل): جرّب تاني بوقت مختلف أو جرب من غير VPN — أو روح لمسار Hetzner المدفوع مباشرة
3. من الكونسول: **Compute → Instances → Create Instance**
4. الاختيارات:
   - Image: **Ubuntu 22.04** (أو 24.04)
   - Shape: **Ampere A1** → حدد **2 OCPU + 12GB** (تحتفظ بالنص التاني لمشروع مستقبلي) أو 4+24 كله
   - **SSH Key**: حمّل المفتاح أو الصق مفتاحك العام
5. **مهم جداً (من أشهر أسباب "السيرفر مش بيرد")**: من **Networking → Virtual Cloud Network → Security Lists** أضف Ingress Rule:
   - Source: `0.0.0.0/0` — Protocol: `TCP` — Port: `80, 443, 22`
6. اتصل: `ssh ubuntu@IP-السيرفر`

---

## 3) النشر — أمر واحد

بعد ما تفتح السيرفر (أي VPS Ubuntu):

### على جهازك (نقل المشروع):
```bash
# من جهازك للسيرفر — rsync أسرع وأذكى (مستثني: node_modules و.next)
rsync -avz --exclude node_modules --exclude .next --exclude 'db/*.db' \
  /home/z/my-project/ ubuntu@SERVER-IP:/home/ubuntu/leados/
```
> 📝 استثنينا القاعدة المحلية عشان السيرفر يبدأ نظيف — لو عايز تنقل بياناتك الحالية: شيل `--exclude 'db/*.db'`

### على السيرفر (أمر واحد):
```bash
cd /home/ubuntu/leados
bash scripts/deploy/deploy-vps.sh
```

السكربت بيديك:
1. تنصيب Docker تلقائياً
2. التحقق من `.env.local` (المفاتيح الـ11 بتنتقل مع المجلد)
3. توليد `AUTH_SECRET` قوي لو مش موجود
4. فتح الجدار الناري (22/80/443)
5. بناء الصورة والتشغيل
6. فحص صحي بعد 30 ثانية ويطبعلك رابط السيرفر

### إيه اللي بيشتغل جوا الحاوية؟
```
docker-compose
├── leados (البناء الكامل)
│   ├── خادم Next.js :3000 (standalone)
│   ├── prod-supervisor.sh → إصلاح ذاتي كل 60 ثانية (خادم + نبضة + باك أب)
│   ├── tick-loop → نبضة كل 11 دقيقة (اكتشاف + بحث + زيزو)
│   └── external-backup-loop → باك أب كل 30 دقيقة في ./backups
└── caddy → HTTPS تلقائي لدومينك
```

---

## 4) ضمانات "مفيش حاجة بترجع خالص" — ثلاث طبقات

| الطبقة | إيه اللي بتعمله |
|---|---|
| **1. docker restart: unless-stopped** | السيرفر يعاد تشغيله/ينهار؟ الحاوية ترجع لوحدها فوراً |
| **2. supervisor داخل الحاوية** | الخادم أو النبضة وقعت؟ ترجع خلال ≤60 ثانية — من غير ما الحاوية نفسها تعاد |
| **3. القاعدة على volume خارج الحاوية** | حتى لو الصورة اتمسحت واتبنيت من جديد — `db/custom.db` و`backups/` بره الصورة، **البيانات عمرها ما تمسح مع تحديث/إعادة بناء** |

+ **بونص**: احتفظ بباك أب أسبوعي خارج السيرفر نفسه (سحابة أو جهازك):
```bash
# على جهازك — cron أسبوعي
0 4 * * 0 rsync -avz ubuntu@SERVER-IP:/home/ubuntu/leados/backups/ ~/leados-offsite-backups/
```

---

## 5) الدومين والـHTTPS (اختياري بس مهم)

1. اشتري دومين (Namecheap/Cloudflare — ~10$/سنة أو مجاني مع بعض الخدمات)
2. وجّه سجل A للدومين → IP السيرفر
3. عدّل `Caddyfile.deploy`: استبدل `leados.example.com` بدومينك
4. `docker compose restart caddy` — **الشهادة بتتنزل وتتجدد تلقائياً**

---

## 6) التحقق بعد النشر (checklist)

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/     # 200
docker compose ps                                                    # leados + caddy = Up
docker compose logs leados | tail -20                               # لوجات نظيفة
ls backups/                                                          # أول باك أب بعد 30 دقيقة
sqlite3 db/custom.db "SELECT COUNT(*) FROM Lead;"                    # الليدز بتزيد
# النبضة السحابية (اختياري احتياط): cron-job.org كل 10 دقايق على
# https://دومينك/api/cron/tick?max=5 مع هيدر x-cron-secret
```

---

## 7) مسار بديل: سحابة 100% مجانية (بدون VPS)

لو مش عايز أي سيرفر تحت إدارتك: **Vercel (واجهة) + Neon (قاعدة Postgres) + cron-job.org (النبضة)** — الدليل التفصيلي في `docs/DEPLOY-ar.md`، والسكيما الإنتاجية `prisma/schema.production.prisma` جاهزة. 

**التنازلات**: الحلقات الخلفية هتتستبدل (النبضة بتتندى من cron-job.org خارجياً — الـendpoint جاهز أصلاً للتصميم ده)، والباك أبوط من Neon dashboard، وworker المتصفح محتاج Railway/Fly منفصل. ده ترحيل أنظف بس فيه شغل ساعة-اتنين.

**رأينا**: لمشروع بيع شغال 24 ساعة بحلقات مراقبة ذاتية — **VPS (Oracle مجاني أو Hetzner بـ5$) هو الطريق الأضمن والأسهل**.
