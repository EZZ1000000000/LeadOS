# LeadOS (زيزو) — دليل المشروع الشامل والحي

> ⚠️ **قاعدة للوكيل الذكي (أنت):** اقرأ الملف ده **أول حاجة** قبل أي شغل في المشروع، واقرأ `worklog.md` (آخر 3 مهام). بعد أي تعديل أو إضافة — **حدّث الملف ده فورًا** في القسم المناسب. الملف ده هو الذاكرة الرسمية للمشروع.

---

## 1) المشروع إيه؟

**LeadOS** — منصة صيد عملاء آلية بتجيب عملاء محتملين (Leads) من **16+ مصدر** على الإنترنت، تصنفهم بأولوية النية الشرائية، وتواصل معاهم بشكل منظم آمن من الحظر. صاحب المشروع: **EZZ1000000000** (مصر).

## 2) البنية المعمارية

| الطبقة | التقنية | ملاحظات |
|---|---|---|
| الواجهة | Next.js 16 App Router — SPA واحدة (`src/app/page.tsx`) → `AppShell` → `views/` | كل اللوحة جوه `src/components/leados/` |
| الإنتاج | Vercel — مشروع `leados-v2` (يوزر gdnjd123-4014) | رابط: `https://leados-v2.vercel.app` |
| قاعدة الإنتاج | Neon Postgres (pooler) | قاعدة تانية قديمة للمودال — التوحيد معلّق |
| التطوير المحلي | SQLite (`db/custom.db`) + `prisma/schema.prisma` | سكيما الإنتاج: `prisma/schema.production.prisma` (enums حقيقية + String[]) |
| نبضة 24/7 | **cron-job.org** (جوب خارجي كل 15 دقيقة — المستخدم بيعمله) | الرابط الجاهز في `download/leados-free-pulse-setup.md` |
| نبضة مؤقتة محلية | `scripts/tmp/interim-pulse.sh` (كل 10 دقائق) | بتموت لو الساندبوكس اتعمل reset — مش دائمة |
| فيسبوك ستيلث | Modal (app: `leados-patrol` + `leados-camoufox`) — **متوقف: سقف صرف خلص** | بيرجع بأول ما المستخدم يرفع السقف |
| جيت هاب | `EZZ1000000000/LeadOS` | **Actions محجوب على مستوى الحساب** — متبنيش عليه للنشر |

## 3) محرك الاكتشاف — الـ16 مصدر

الكود: `src/lib/discovery.ts` — `PLATFORM_SITES` هو القاموس الرسمي للمنصات.

**عقل المهارات (اتضاف 2026-09-28 — طلب «بحث أذكى بـ AI يتعلم + نظام Skills»):**
- **مكتبة مهارات بصيغة SKILL.md** (متوافقة Anthropic Agent Skills — أي skill من جيت هاب يتحط فولدر ويشتغل): `skills/discovery/<dir>/SKILL.md` ×19 (16 منصة + خرايط + ويب). الملفات بتتجمع في الباندل بـ`bun run skills:gen` (بيشتغل في كل build) → `src/lib/skills/manifest.generated.ts`.
- **التعلم**: كل ليد بيرفع وزن منصته في `SkillStat` (ريكورد `recordSkillLead`) + الاستعلام الفايت بيتحفظ درس في `SkillLesson` — الدروس بتنادى **الأول** في كل جوب. جوب جاف = هدم وزن (-0.08/-0.03) — المنصات الصامية بتنام.
- **المنتقي**: الموجة الدوارة بتترتب بالأوزان المتعلمة (`expandSourceTypes({weighted})`) + إعادة ترتيب AI كل 30 دقيقة (`aiSelectPlatforms` — بتقرا كتالوج المهارات + أرقام الأداء).
- **حدّاد الاستعلامات**: منصة دوّارة كل جوب بتاخد 3 استعلامات AI جديدة للنيش (`freshAiQueries` — كوتة: منصة/24س + 10د/instance) — بتتحفظ دروس `source=ai`.
- **فلتر نشر لكل منصة**: كورا/ديسكورد 90 يوم، معارض 75، أدلة/تقييمات 60، إعلانات/سوق 30 — (الـ14 يوم كان بيقتلهم).
- **تسجيل النداءات**: `AiProvider` enum فيه DAHL/NVIDIA — بدونهم الـAiRun بيسقط بصمت.
- **نظافة الطابور**: قاعدة ليها جوب حي (QUEUED/RUNNING) متزرعش تاني — قفل تضخم الطابور. + إحياء RUNNING العالقة >20 دقيقة.

| المنصة | المواقع | بيجيب إيه | ميكانيزم |
|---|---|---|---|
| FACEBOOK | facebook.com | جروبات وصفحات فيها طلبات خدمات | بحث `site:` + فلترة |
| INSTAGRAM | instagram.com | متاجر وبيزنس صغير بيعلن | بحث `site:` |
| X | x.com + twitter.com | شكاوى وطلبات لحظية | بحث `site:` |
| LINKEDIN | linkedin.com | شركات + مدراء (الشخصي `/in/` بيتشال) | بحث `site:` |
| REDDIT | reddit.com | منشورات نية شراء بنصها الكامل | **JSON API مجاني** ← fallback بحث |
| TIKTOK / YOUTUBE | tiktok / youtube | بيزنس محلي + مراجعات | بحث `site:` |
| DIRECTORY | yellowpages.eg + 4 تانيين | قوائم بيزنس مكتملة | بحث `site:` |
| JOBS | wuzzuf + forasna + linkedin/jobs | **شركات بتوظف = بتكبر** (فلتر وظايف: مدير/مبرمج/مبيعات...) | بحث `site:` بمسار |
| MARKETPLACE | olx.com.eg + dubizzle + hatla2ee | تجار وناس بتبيع أصول | بحث `site:` |
| TELEGRAM | 8 قنوات مصرية حية (ال بورصة، المال، BusinessEgypt...) | بوستات أعمال وفرص | **t.me/s بدون مفاتيح** ← fallback بحث |
| FREELANCE | mostaql + khamsat + bahr | أصحاب مشاريع بيدوروا مبرمجين دلوقتي | بحث `site:` |
| ADS_LIBRARY | facebook.com/ads/library | **مين بيصرف على إعلانات** = عنده ميزانية | بحث `site:` بمسار |
| REVIEWS | maps + tripadvisor + elmenus | بيزنس عنده شكاوى تقييمات | بحث `site:` |
| EVENTS | fb/events + egyta + cairoict + إكسبوهات | فعاليات B2B وشبكينج | بحث `site:` بمسار |
| QUORA | quora + ar.quora | أسئلة نية («أفضل سيستم في مصر؟») | بحث `site:` |
| DISCORD | discord.com + discord.gg | مجتمعات أصحاب بيزنس | بحث `site:` |
| (أساس) GOOGLE_SEARCH / WEBSITE / GOOGLE_MAPS | — | ويب عام + خرايط (Serper Places ← Google Places) | `webAdapter` / `placesToItems` |

### ميكانيزم الدوران (أهم حاجة — متكسرهاش):
1. **`expandSourceTypes(declared, {all?})`**: المجاني الأول (REDDIT+TELEGRAM دايمًا) ← أنواع القاعدة ← **موجة 4 منصات بالساعة** `(hour*4) % len`. لو `{all:true}` (المسح الشامل `?full=1`) ← كل المنصات مرة واحدة.
2. **أسئلة كل منصة بلغتها** (`PLATFORM_QUERY_SHAPES` + `platformQueries`): ووظايف بتفهم «مطلوب»، أوليكس بيفهم «للبيع»، كورا بتفهم «أفضل/إزاي» — + **بذور مضمونة** لكل منصة بتدور بالساعة. (السبب: «كافيهات مدينة نصر» على wuzzuf = صفر نتايج — 9 منصات كانت ميتة).
3. **`runDiscovery` — عدالة التوزيع**: جولات round-robin (لحد 4) + **دلو لكل نوع** (سقف limitPerQuery×2 — المجاني مش بيبلع الكوتة) + **دمج متناوب** في النهاية (كل منصة ليها حضور في النتيجة مهما كان ترتيبها). سقف 10 بحث/جوبة (18 للمسح الشامل).
4. **`matchesSite`**: host+path — يمنع تسريب النتايج بين المنصات.
5. **3-tier fallback** في `platformAdapter`: `(site:A OR site:B) q` ← `site:A + أول 5 كلمات` ← بحث عام + فلترة.
6. **`geoPin`**: مصر تلقائيًا إلا لو الاستعلام خليجي.

## 4) أولوية الصياد — تصنيف النية (اتضاف 2026-09-28)

عند الابتلاع (`ingestDiscoveredItems` في `src/lib/queue.ts`) كل ليد بياخد:
- **`sourcePlatform`** (عمود حقيقي + index): المنصة من الـ16 — للفلتر في اللوحة.
- **`intentSignal`** (عمود حقيقي + index):
  | الإشارة | معناها | مكافأة Score |
  |---|---|---|
  | `EXPLICIT_NEED` | كتب إنه محتاج/عايز/مطلوب (ريجكس عربي+إنجليزي) | **+8** |
  | `COMPETITOR_ENGAGER` | بيدور على بديل/توصية/مقارنة | **+5** |
  | `AD_SPENDER` | لقيته في مكتبة إعلانات ميتا | — |
  | `MARKET_LIST` | بيزنس من قوائم (خرايط/أدلة أعمال/تقييمات) — بيزنس حقيقي بدون نية معلنة | score≥45 مجبر |
- **قواعد الجودة لكل منصة**: بروفايلات لينكدإن الشخصية مرفوضة (/in/)؛ JOBS مدير/مبرمج/مبيعات/تسويق بس؛ **DIRECTORY/REVIEWS = بيزنس مؤهل زي الخرايط** (isListingBusiness — اتعمل 2026-09-28 عشان كانوا بيرفضوا كليدز وهما قوائم بيزنس حقيقية).
- **سرقة المنافسين**: في `processDiscoveryJob` — لو في منافسين مسجلين (جدول Competitor)، استعلامات `بديل <منافس> توصية` بتتقدم أول الـqueries.
- **Backfill** اتعمل للليدز القدام (من `ContentItem.rawData.platform` + ريجكس على summary).

## 5) سلسلة النبضة (Heartbeat Chain)

1. **cron-job.org** (رابط فيه `?secret=<CRON_SECRET_ALT>`) ← كل 15 دقيقة. **`&full=1` = مسح شامل** — جوبة أولوية 100 لكل ورشة على كل المنصات دفعة واحدة (للزرع الفوري — متستخدمهاش في الكرن العادي).
2. الـendpoint: `src/app/api/cron/tick/route.ts` — **آسنكرون**: رد فوري (`{"ok":true,"async":true}` في <1 ثانية) والشغل يكمل في الخلفية (`after` من next/server، `maxDuration=120`). ده بيحمي من مهلة 30 ثانية بتاعة cron-job.org.
3. الشغل في الخلفية: `processTick(3)` (اكتشاف/بحث عميق/ردود) + `scanDueGroups` (جروبات) + `zizoTick` (نبضة البيع).
4. احتياطات: نبضة محلية كل 10 دقيقة + Vercel Cron يومي (`vercel.json` 07:00).

## 6) سياسة التواصل المنظم ضد الحظر (Anti-Ban Policy)

- **زيزو** (`src/lib/agent/zizo/brain.ts`): ساعات إنسان قبل الإرسال + سقف يومي + فجوة بين الرسائل + تأخير بشري (لحد 8 ثواني) — اللي البوابة ترفضه بيبقى درافت.
- **السلاسل** (Sequences): سياسة **رد-فقط** — الخطوات بتطلع مهام بنص جاهز، مفيش إرسال آلي استباقي.
- **قنوات التواصل لكل ليد**: تليفون/موقع/رابط المنصة موجودين على Business + LeadSource.sourceUrl — الوكيل بيختار قناة واحدة، رسالة واحدة مخصصة، من غير ملاحقة على كل المنصات.
- **ممنوع**: نفس الرسالة لأكتر من ليد بنفس الصيغة، تواصل على منصة قفلت فيها session، أو إرسال خارج ساعات 10ص-8م (توقيت مصر).

## 7) عمليات الإنتاج (Playbook)

```bash
# نشر (بعد commit):
git push origin main
source scripts/deploy/.tokens && VERCEL_TOKEN=$VERCEL_TOKEN bunx vercel deploy --prod --yes

# دفع سكيما على Neon (الـ.env المحلي بيتقفل فوق المتغير — انقله مؤقتًا):
mv .env .env.bak && source scripts/deploy/.tokens && export DATABASE_URL \
  && bunx prisma db push --schema=prisma/schema.production.prisma; mv .env.bak .env

# استعلام SQL على الإنتاج:
python3 dbq.py NEON_LEADOS "SELECT ..."

# نبضة يدوية:
curl "https://leados-v2.vercel.app/api/cron/tick?secret=<CRON_SECRET_ALT>&max=3"

# تجديد الأسرار من Vercel:
VERCEL_TOKEN=$VERCEL_TOKEN bunx vercel env pull scripts/deploy/.env.prod.pull --yes --environment=production
```

## 8) شمarih (Pitfalls) — التفت عليها قبل ما تضيع ساعات:

1. **`.tokens` — DATABASE_URL لازم بين تكس `"..."`**: اللينك فيه `&` والـ`source` بيكسر السطر على أول `&` (يوم كامل ضاع على ده).
2. **`.env` المحلي بيتقفل فوق DATABASE_URL** في كل أوامر prisma — انقله مؤقتًا ورجعه.
3. **الترمينال بياكل `[m` كـANSI**: لو سطر شكله مكسور (زي `inScore`) اعمل `od -c` أو python repr قبل ما تحكم.
4. **سكيما dev ≠ سكيما إنتاج**: dev فيه Strings/Json، إنتاج فيه enums/String[] — عدّل **الاتنين دايمًا**. (tsc فيه أخطاء قديمة معروفة في src/api من الفرق ده — البناء بيتجاهلها، متصلحش دلوقتي غير لو وقفت قدامك.)
5. **GitHub Actions محجوب** على حساب المستخدم (startup_failure حتى على echo) — النشر Vercel CLI مباشرة.
6. **مهلة cron خارجي = 30 ثانية** → الـtick لازم يفضل آسنكرون (رد فوري + after).
7. **z-ai provider بيرفض سلاسل `site: OR` الطويلة** → عشان كده فيه 3-tier fallback.
8. **فيه قاعدتين Neon**: قاعدة Vercel (573+ ليد) وقاعدة المودال القديمة (166 ليد/289 بوست) — التوحيد أول ما المودال يفتح.

## 9) الحالة دلوقتي (آخر تحديث: 2026-09-28 ~01:30)

- ✅ **عقل المهارات حي في الإنتاج**: DAHL MiniMax بيكصنف في الإنتاج (16-29 نداء/نبضة، كلها ناجحة — سبب الظهور: enum AiProvider كان ناقص DAHL/NVIDIA فالتسجيل كان بيقع بصمت) + أول ليدز DIRECTORY وREVIEWS في تاريخ المشروع.
- ✅ دروس AI متولدة ومحفوظة (كورا: «افضل برنامج كاشير للمطاعم الصغيرة»...) + دروس learned من ليدز حقيقية («كافيه مصر انستجرام»). الموجة بتترتب بالأوزان.
- ✅ مفاتيح DAHL + NVIDIA اتحقنت في Vercel env (كانت ناقصة — العقل كان شغال محلي بس!). فحص دائم: `/api/ai-check?secret=`.
- ✅ تصنيف AI متوازن: بيزنس ناشط تجاريًا (بيبيع/بيعرض/بيوظف) = lead — مش بس «محتاج» اللفظي.
- ⏳ **محجوز على المستخدم**: (1) جوب cron-job.org — الرابط في `download/leados-free-pulse-setup.md` (2) رفع سقف Modal → فيسبوك ستيلث + توحيد القاعدتين.
- ⏳ تتبع: ADS_LIBRARY/EVENTS/DISCORD/QUORA/TELEGRAM/JOBS — الفهرسة بتاعتهم ضعيفة/البذور بتدور — الموجة الموزونة + الدروس بتغطيهم تدريجيًا. الطابور بيجف بعد نظافة الجدولة.

## 10) أين تجد كل حاجة

| الحاجة | المسار |
|---|---|
| محرك الاكتشاف + المنصات | `src/lib/discovery.ts` |
| عقل المهارات (registry/learning/selector) | `src/lib/skills/` + ملفات `skills/discovery/*/SKILL.md` |
| فحص العقل من الإنتاج | `GET /api/ai-check?secret=` (env + ping + تصنيف حقيقي) |
| كارت عقل المهارات في اللوحة | `src/components/leados/views/skills-card.tsx` + `GET /api/skills` |
| الابتلاع + التصنيف + الطوابير | `src/lib/queue.ts` |
| نبضة الإنتاج | `src/app/api/cron/tick/route.ts` |
| واجهة الليدز (فلاتر المنصات/النية) | `src/components/leados/views/leads.tsx` |
| سجل المهام التاريخي | `worklog.md` |
| أسرار (أسماء + قيم) | `scripts/deploy/.tokens` (**متنشرش أبدًا**) |
| دليل نبضة cron-job.org | `download/leados-free-pulse-setup.md` |
| اختبارات الموجة الحية | `scripts/tmp/test-wave-fair.ts` / `run-16-live.ts` |
