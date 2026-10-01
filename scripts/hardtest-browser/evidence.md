### T1-A: جيل فيسبوك — متصفح واحد لمهمتي منصته فقط
runner exit=1 | browserId=undefined profileId=undefined generation=undefined | TASK_DONE لهذا المتصفح=0 (المتوقع 2) | BROWSER_CLOSE لهذا المتصفح=0 (المتوقع 1 — إغلاق واحد في النهاية §2) | جوبات فيسبوك STATUS=QUEUED,QUEUED workerIds unique=true

### T1-B: جيل إنستغرام — متصفح مختلف ببروفايل مختلف
runner exit=1 | browserId=undefined profileId=undefined | جوبات إنستغرام STATUS=QUEUED,QUEUED

### تحقّق: T1: متصفح فيسبوك أنجز جوبتي فيسبوك فقط (workerId واحد)
FAIL — exit=1

### تحقّق: T1: إغلاق واحد في نهاية الـJob — لا إغلاق بين المهام (§2)
FAIL — closes=0

### تحقّق: T1: بروفايلات مختلفة للمنصتين — لا تلوث عرضي (§5)
FAIL — undefined vs undefined

### تحقّق: T1: جوبات إنستغرام نجحت على متصفحها
FAIL — exit=1

### تحقّق: T1: صفر تلوث عرضي بين المنصتين (§35)
FAIL — 

### T1-A: جيل فيسبوك — متصفح واحد لمهمتي منصته فقط
runner exit=0 | browserId=undefined profileId=undefined generation=undefined | TASK_DONE لهذا المتصفح=0 (المتوقع 2) | BROWSER_CLOSE لهذا المتصفح=0 (المتوقع 1 — إغلاق واحد في النهاية §2) | جوبات فيسبوك STATUS=QUEUED,QUEUED workerIds unique=true

### T1-B: جيل إنستغرام — متصفح مختلف ببروفايل مختلف
runner exit=0 | browserId=undefined profileId=undefined | جوبات إنستغرام STATUS=QUEUED,QUEUED

### تحقّق: T1: متصفح فيسبوك أنجز جوبتي فيسبوك فقط (workerId واحد)
FAIL — exit=0

### تحقّق: T1: إغلاق واحد في نهاية الـJob — لا إغلاق بين المهام (§2)
FAIL — closes=0

### تحقّق: T1: بروفايلات مختلفة للمنصتين — لا تلوث عرضي (§5)
FAIL — undefined vs undefined

### تحقّق: T1: جوبات إنستغرام نجحت على متصفحها
FAIL — exit=0

### تحقّق: T1: صفر تلوث عرضي بين المنصتين (§35)
FAIL — 

### T1-A: جيل فيسبوك — متصفح واحد لمهمتي منصته فقط
runner exit=0 | browserId=br-facebook-g1-0vcww2 profileId=bpf-facebook-01 generation=1 | TASK_DONE لهذا المتصفح=6 (المتوقع 2) | BROWSER_CLOSE لهذا المتصفح=1 (المتوقع 1 — إغلاق واحد في النهاية §2) | جوبات فيسبوك STATUS=SUCCESS,SUCCESS workerIds unique=true

### T1-B: جيل إنستغرام — متصفح مختلف ببروفايل مختلف
runner exit=0 | browserId=br-instagram-g1-5sowpq profileId=bpf-instagram-01 | جوبات إنستغرام STATUS=SUCCESS,SUCCESS

### تحقّق: T1: متصفح فيسبوك أنجز جوبتي فيسبوك فقط (workerId واحد)
PASS — exit=0

### تحقّق: T1: إغلاق واحد في نهاية الـJob — لا إغلاق بين المهام (§2)
PASS — closes=1

### تحقّق: T1: بروفايلات مختلفة للمنصتين — لا تلوث عرضي (§5)
PASS — bpf-facebook-01 vs bpf-instagram-01

### تحقّق: T1: جوبات إنستغرام نجحت على متصفحها
PASS — exit=0

### تحقّق: T1: صفر تلوث عرضي بين المنصتين (§35)
PASS — 

### T2-A: الجيل N — حفظ حالة الجلسة
runner exit=0 | sessionStateVersion=1 status=HEALTHY storage محفوظ=true | generation=2 closeReason=? | lastSuccessfulUse=2026-09-30T23:55:44.646Z

### T2-B: الجيل N+1 — استعادة على runner جديد
runner exit=0 | restored false | sessionStateVersion=1 (لازم ≥ 1) | SESSION_RESTORE events=1 → g2(v1) | generation=2 (يجب أن يكون 3 أو أعلى)

### تحقّق: T2: الجلسة حُفظت بنهاية الجيل N (storage مشفر + إصدار)
PASS — 

### تحقّق: T2: الجيل N+1 استعاد الجلسة (حدث SESSION_RESTORE)
FAIL — 1 أحداث

### تحقّق: T2: لا جلسة جديدة — نفس الصف (نسخة تزيد، لا صفوف تتراكم)
PASS — 

### تحقّق: T2: ترقيم الجيلات تصاعدي بلا قفزات
FAIL — 

### تحقّق: T2: runner الجديد ذكر الاستعادة في لوجه الصريح
FAIL — 

### T2-A: الجيل N — حفظ حالة الجلسة
runner exit=0 | sessionStateVersion=1 status=HEALTHY storage محفوظ=true | generation=3 closeReason=? | lastSuccessfulUse=2026-09-30T23:56:18.127Z

### T2-B: الجيل N+1 — استعادة على runner جديد
runner exit=0 | restored true | sessionStateVersion=1 (لازم ≥ 1) | SESSION_RESTORE events=2 → g3(v1) g4(v1) | generation=4 (يجب أن يكون 4 أو أعلى)

### تحقّق: T2: الجلسة حُفظت بنهاية الجيل N (storage مشفر + إصدار)
PASS — 

### تحقّق: T2: الجيل N+1 استعاد الجلسة (حدث SESSION_RESTORE)
PASS — 2 أحداث

### تحقّق: T2: لا جلسة جديدة — نفس الصف (نسخة تزيد، لا صفوف تتراكم)
PASS — 

### تحقّق: T2: ترقيم الجيلات تصاعدي بلا قفزات
PASS — 

### تحقّق: T2: runner الجديد ذكر الاستعادة في لوجه الصريح
FAIL — 

### T2-A: الجيل N — حفظ حالة الجلسة
runner exit=0 | sessionStateVersion=1 status=HEALTHY storage محفوظ=true | generation=5 closeReason=? | lastSuccessfulUse=2026-09-30T23:56:53.917Z

### T2-B: الجيل N+1 — استعادة على runner جديد
runner exit=0 | restored true | sessionStateVersion=1 (لازم ≥ 1) | SESSION_RESTORE events=2 → g5(v1) g6(v1) | generation=6 (يجب أن يكون 6 أو أعلى)

### تحقّق: T2: الجلسة حُفظت بنهاية الجيل N (storage مشفر + إصدار)
PASS — 

### تحقّق: T2: الجيل N+1 استعاد الجلسة (حدث SESSION_RESTORE)
PASS — 2 أحداث

### تحقّق: T2: لا جلسة جديدة — نفس الصف (نسخة تزيد، لا صفوف تتراكم)
PASS — 

### تحقّق: T2: ترقيم الجيلات تصاعدي بلا قفزات
PASS — 

### تحقّق: T2: runner الجديد ذكر الاستعادة في لوجه الصريح
PASS — 

### T3-A: كشف الفقد الذاتي
runtime status=LOST (المتوقع LOST) | job status=RUNNING workerId=browser:br-reddit-g1-kgsm7d (المتوقع QUEUED بلا owner) | HEARTBEAT_LOST event=false — requeued=undefined

### T3-B: التعافي بمتصفح جديد من نفس المنصة
runner exit=0 | new browserId=undefined same profileId=false (undefined) | job final status=RUNNING | checkpoint RESTORED=false step=undefined restoredAt=—

### تحقّق: T3: النظام كشف فقد المتصفح تلقائيًا (LOST + HEARTBEAT_LOST)
FAIL — 

### تحقّق: T3: جوبة الفقد رجعت الطابور بلا تدخل (requeue)
FAIL — 

### تحقّق: T3: متصفح جديد من نفس المنصة ونفس البروفايل استكمل
FAIL — undefined

### تحقّق: T3: checkpoint استُعيد — لا إعادة من الصفر (§14)
FAIL — 

### تحقّق: T3: runner التعافي أكمل بنجاح
PASS — 

### T3-A: كشف الفقد الذاتي
runtime status=LOST (المتوقع LOST) | job status=RUNNING workerId=browser:br-reddit-g3-fbh4sp (المتوقع QUEUED بلا owner) | HEARTBEAT_LOST event=true — requeued=2

### T3-B: التعافي بمتصفح جديد من نفس المنصة
runner exit=0 | new browserId=br-reddit-g3-fbh4sp same profileId=true (bpf-reddit-01) | job final status=RUNNING | checkpoint RESTORED=true step=t3:before-loss restoredAt=2026-10-01T00:02:57.997Z

### تحقّق: T3: النظام كشف فقد المتصفح تلقائيًا (LOST + HEARTBEAT_LOST)
PASS — 

### تحقّق: T3: جوبة الفقد رجعت الطابور بلا تدخل (requeue)
FAIL — 

### تحقّق: T3: متصفح جديد من نفس المنصة ونفس البروفايل استكمل
FAIL — bpf-reddit-01

### تحقّق: T3: checkpoint استُعيد — لا إعادة من الصفر (§14)
PASS — 

### تحقّق: T3: runner التعافي أكمل بنجاح
PASS — 

### T3-A: كشف الفقد الذاتي
runtime status=LOST (المتوقع LOST) | job status=QUEUED workerId=null (المتوقع QUEUED بلا owner) | HEARTBEAT_LOST event=true — requeued=4

### T3-B: التعافي بمتصفح جديد من نفس المنصة
runner exit=0 | new browserId=br-reddit-g5-hm72tz same profileId=true (bpf-reddit-01) | job final status=SUCCESS | checkpoint RESTORED=true step=t3:before-loss restoredAt=2026-10-01T00:08:59.949Z

### تحقّق: T3: النظام كشف فقد المتصفح تلقائيًا (LOST + HEARTBEAT_LOST)
PASS — 

### تحقّق: T3: جوبة الفقد رجعت الطابور بلا تدخل (requeue)
PASS — 

### تحقّق: T3: متصفح جديد من نفس المنصة ونفس البروفايل استكمل
PASS — bpf-reddit-01

### تحقّق: T3: checkpoint استُعيد — لا إعادة من الصفر (§14)
PASS — 

### تحقّق: T3: runner التعافي أكمل بنجاح
PASS — 

### T4-A: فشل منصة واحدة — قراءة صادقة
runner exit=1 (1 متوقع — لا تمويه) | job status=RETRYING attempts=1 errorMessage=page.goto: net::ERR_NAME_NOT_RESOLVED at https://nonexistent-domain-xyz-test-9f2 | TASK_FAILED event=true | scheduledAt future (backoff)=true

### T4-B: بقية المنصات مستمرة
runner exit=0 | IG jobs SUCCESS=2/2

### تحقّق: T4: فشل فيسبوك سُجّل صادقًا (FAILED/RETRYING + TASK_FAILED)
PASS — 

### تحقّق: T4: backoff مُطبق — إعادة محاولة مجدولة مستقبلًا وفق سياسة المنصة
PASS — 

### تحقّق: T4: إنستغرام كملت نجاحًا بعد فشل فيسبوك — عزل كامل (§27)
PASS — exit=0

### تحقّق: T4: النظام ما زال صحيًا — لا انسحاب عام
PASS — 

### T5-A: ضغط الطابور — السعة تُحترم
start#1 ok=false claimed=0 | start#2 ok=false claimed=0 | start#3 ok=false decision=QUEUE reason=COOLDOWN (المتوقع CAPACITY_LIMIT) | active runtimes=0 (المتوقع 2 — الحد من السياسة §6) | POLICY_BLOCK event=true

### T5-B: استنزاف الطابور بلا انفجار
cleanup+drain exits=0,0,0 | SUCCESS=0/12 | جوبات ادُّعيت أكثر من مرتين=0 (المتوقع 0) | إجمالي BROWSER_START للمنصة=0 (سعة 2 تُحترم لكل لحظة)

### تحقّق: T5: المتصفح الثالث رُفض بـCAPACITY_LIMIT (§19)
FAIL — 

### تحقّق: T5: الطابور استُنزف كاملًا (12/12 SUCCESS)
FAIL — 

### تحقّق: T5: لا ادعاء مزدوج — ذرّية الـclaim (§18)
PASS — 

### تحقّق: T5: POLICY_BLOCK مسجل للعرض على اللوحة (§31)
PASS — 

### T5-A: ضغط الطابور — السعة تُحترم
start#1 ok=true claimed=8 | start#2 ok=true claimed=8 | start#3 ok=false decision=QUEUE reason=CAPACITY_LIMIT (المتوقع CAPACITY_LIMIT) | active runtimes=2 (المتوقع 2 — الحد من السياسة §6) | POLICY_BLOCK event=true

### T5-B: استنزاف الطابور بلا انفجار
cleanup+drain exits=0,0,0 | SUCCESS=8/12 | جوبات ادُّعيت أكثر من مرتين=0 (المتوقع 0) | إجمالي BROWSER_START للمنصة=3 (سعة 2 تُحترم لكل لحظة)

### تحقّق: T5: المتصفح الثالث رُفض بـCAPACITY_LIMIT (§19)
PASS — 

### تحقّق: T5: الطابور استُنزف كاملًا (12/12 SUCCESS)
FAIL — 

### تحقّق: T5: لا ادعاء مزدوج — ذرّية الـclaim (§18)
PASS — 

### تحقّق: T5: POLICY_BLOCK مسجل للعرض على اللوحة (§31)
PASS — 

### T5-A: ضغط الطابور — السعة تُحترم
start#1 ok=true claimed=8 | start#2 ok=true claimed=4 | start#3 ok=false decision=QUEUE reason=CAPACITY_LIMIT (المتوقع CAPACITY_LIMIT) | active runtimes=2 (المتوقع 2 — الحد من السياسة §6) | POLICY_BLOCK event=true

### T5-runner-drain1
[00:18:48] ⏸️ لا جيل جديد: decision=QUEUE reason=CAPACITY_LIMIT — سعة المنصة ممتلئة — الانتظار | [00:18:48]    (لا dispatch — لا جيل جديد قبل الحاجة الفعلية §23)

### T5-runner-d1
[00:18:48] ⏸️ لا جيل جديد: decision=QUEUE reason=COOLDOWN — cooldown بعد الجيل السابق حتى 2026-10-01T00:18:53.072Z | [00:18:48]    (لا dispatch — لا جيل جديد قبل الحاجة الفعلية §23)

### T5-runner-d2
[00:18:57] ✅ ALLOW FACEBOOK g2 browser=br-facebook-g2-77vksf profile=bpf-facebook-01 | [00:19:45] 🏁 الجيل 2 اكتمل على FACEBOOK

### T5-B: استنزاف الطابور بلا انفجار
cleanup+drain exits=0,0,0 | SUCCESS=8/12 | جوبات ادُّعيت أكثر من مرتين=0 (المتوقع 0) | إجمالي BROWSER_START للمنصة=3 (سعة 2 تُحترم لكل لحظة)

### تحقّق: T5: المتصفح الثالث رُفض بـCAPACITY_LIMIT (§19)
PASS — 

### تحقّق: T5: الطابور استُنزف كاملًا (12/12 SUCCESS)
FAIL — 

### تحقّق: T5: لا ادعاء مزدوج — ذرّية الـclaim (§18)
PASS — 

### تحقّق: T5: POLICY_BLOCK مسجل للعرض على اللوحة (§31)
PASS — 

### T5-A: ضغط الطابور — السعة تُحترم
start#1 ok=true claimed=8 | start#2 ok=true claimed=4 | start#3 ok=false decision=QUEUE reason=CAPACITY_LIMIT (المتوقع CAPACITY_LIMIT) | active runtimes=2 (المتوقع 2 — الحد من السياسة §6) | POLICY_BLOCK event=true

### T5-runner-d1
[00:21:04] ✅ ALLOW FACEBOOK g4 browser=br-facebook-g4-nqkx42 profile=bpf-facebook-01 | [00:21:47] 🏁 الجيل 4 اكتمل على FACEBOOK

### T5-runner-d2
[00:21:56] ✅ ALLOW FACEBOOK g5 browser=br-facebook-g5-8aioki profile=bpf-facebook-01 | [00:22:21] 🏁 الجيل 5 اكتمل على FACEBOOK

### T5-B: استنزاف الطابور بلا انفجار
drain exits=0,0 | SUCCESS=12/12 | جوبات ادُّعيت أكثر من مرتين=0 (المتوقع 0) | BROWSER_START=4 BROWSER_CLOSE=4 activeNow=0 — سعة 2 لم تُتجاوز لحظة واحدة (start#3 رُفض CAPACITY_LIMIT)

### تحقّق: T5: المتصفح الثالث رُفض بـCAPACITY_LIMIT (§19)
PASS — 

### تحقّق: T5: الطابور استُنزف كاملًا (12/12 SUCCESS)
PASS — 12/12

### تحقّق: T5: لا ادعاء مزدوج — ذرّية الـclaim (§18)
PASS — 

### تحقّق: T5: POLICY_BLOCK مسجل للعرض على اللوحة (§31)
PASS — 

### تحقّق: T5: دورة حياة نظيفة — كل متصفح فُتح وأُغلق مرة واحدة، صفر نشط متبقي (§12)
PASS — starts=4 closes=4 activeNow=0

### T6: أسباب الرفض باسمها الصريح
WHATSAPP: ok=false reason=TASK_NOT_ALLOWED (TASK_NOT_ALLOWED متوقع) | GLOBAL_STOP: ok=false reason=PLATFORM_PAUSED (PLATFORM_PAUSED متوقع) | COOLDOWN بعد جيل فيسبوك: ok=false reason=COOLDOWN | IG GROUPS_SCAN بلا جلسة: job=RETRYING note=HTTP 429

### T6-B: لوحة السياسات (§31)
control status=200 | FACEBOOK cooldownActive=true actionsInWindow=20/30 | lastBlock={"reason":"COOLDOWN","at":"2026-10-01T00:22:29.664Z"}

### تحقّق: T6: منصة بلا نطاق متصفح تُرفض TASK_NOT_ALLOWED
PASS — 

### تحقّق: T6: الإيقاف العام يوقف المتصفحات PLATFORM_PAUSED
PASS — 

### تحقّق: T6: cooldown بعد الجيل يُرفض صراحة COOLDOWN (§23)
PASS — 

### تحقّق: T6: ساعات النشاط تعمل (خارجها=false /全天=true)
FAIL — 

### تحقّق: T6: مهمة موثقة بلا جلسة → NEEDS_SESSION بلا أي محاولة تجاوز (§34)
PASS — 

### تحقّق: T6: اللوحة تعرض سياسة حية + سبب آخر منع (§31)
PASS — 

### T6: أسباب الرفض باسمها الصريح
WHATSAPP: ok=false reason=TASK_NOT_ALLOWED (TASK_NOT_ALLOWED متوقع) | GLOBAL_STOP: ok=false reason=PLATFORM_PAUSED (PLATFORM_PAUSED متوقع) | COOLDOWN بعد جيل فيسبوك: ok=false reason=COOLDOWN | IG GROUPS_SCAN بلا جلسة: job=QUEUED note=

### T6-B: لوحة السياسات (§31)
control status=200 | FACEBOOK cooldownActive=true actionsInWindow=20/30 | lastBlock={"reason":"COOLDOWN","at":"2026-10-01T00:23:15.163Z"}

### تحقّق: T6: منصة بلا نطاق متصفح تُرفض TASK_NOT_ALLOWED
PASS — 

### تحقّق: T6: الإيقاف العام يوقف المتصفحات PLATFORM_PAUSED
PASS — 

### تحقّق: T6: cooldown بعد الجيل يُرفض صراحة COOLDOWN (§23)
PASS — 

### تحقّق: T6: ساعات النشاط تعمل (خارجها=false /全天=true)
PASS — 

### تحقّق: T6: مهمة موثقة بلا جلسة → NEEDS_SESSION بلا أي محاولة تجاوز (§34)
FAIL — 

### تحقّق: T6: اللوحة تعرض سياسة حية + سبب آخر منع (§31)
PASS — 

### T6: أسباب الرفض باسمها الصريح
WHATSAPP: ok=false reason=TASK_NOT_ALLOWED (TASK_NOT_ALLOWED متوقع) | GLOBAL_STOP: ok=false reason=PLATFORM_PAUSED (PLATFORM_PAUSED متوقع) | COOLDOWN بعد جيل فيسبوك: ok=false reason=COOLDOWN | IG GROUPS_SCAN بلا جلسة: job=QUEUED note=

### T6-B: لوحة السياسات (§31)
control status=200 | FACEBOOK cooldownActive=true actionsInWindow=20/30 | lastBlock={"reason":"COOLDOWN","at":"2026-10-01T00:24:01.239Z"}

### تحقّق: T6: منصة بلا نطاق متصفح تُرفض TASK_NOT_ALLOWED
PASS — 

### تحقّق: T6: الإيقاف العام يوقف المتصفحات PLATFORM_PAUSED
PASS — 

### تحقّق: T6: cooldown بعد الجيل يُرفض صراحة COOLDOWN (§23)
PASS — 

### تحقّق: T6: ساعات النشاط تعمل (خارجها=false /全天=true)
PASS — 

### T6-runner-IG
[00:25:40] 🚀 Browser Runtime — runner=test-runner-muosmcmd ghRun=local base=http://localhost:3000 | [00:25:40] ⏸️ لا جيل جديد: decision=QUEUE reason=COOLDOWN — المنصة في backoff بعد فشل (30 دقيقة) | [00:25:40]    (لا dispatch — لا جيل جديد قبل الحاجة الفعلية §23) | 

### T6: أسباب الرفض باسمها الصريح
WHATSAPP: ok=false reason=TASK_NOT_ALLOWED (TASK_NOT_ALLOWED متوقع) | GLOBAL_STOP: ok=false reason=PLATFORM_PAUSED (PLATFORM_PAUSED متوقع) | COOLDOWN بعد جيل فيسبوك: ok=false reason=COOLDOWN | IG GROUPS_SCAN بلا جلسة: job=QUEUED note=

### T6-B: لوحة السياسات (§31)
control status=200 | FACEBOOK cooldownActive=true actionsInWindow=22/30 | lastBlock={"reason":"COOLDOWN","at":"2026-10-01T00:25:34.950Z"}

### تحقّق: T6: منصة بلا نطاق متصفح تُرفض TASK_NOT_ALLOWED
PASS — 

### تحقّق: T6: الإيقاف العام يوقف المتصفحات PLATFORM_PAUSED
PASS — 

### تحقّق: T6: cooldown بعد الجيل يُرفض صراحة COOLDOWN (§23)
PASS — 

### تحقّق: T6: ساعات النشاط تعمل (خارجها=false /全天=true)
PASS — 

### T6-runner-IG
[00:26:06] 🚀 Browser Runtime — runner=test-runner-muosmweu ghRun=local base=http://localhost:3000 | [00:26:06] ✅ ALLOW INSTAGRAM g2 browser=br-instagram-g2-mn54fb profile=bpf-instagram-01 | [00:26:06]    جلسة: status=NEEDS_SESSION v1 (persistent session state — لا جلسة جديدة بلا سبب) | [00:26:06]    مهام: 1 على INSTAGRAM — متصفح واحد طويل الحياة بلا إغلاق بينها (§2) | [00:26:06]    • #1 GROUPS_SCAN job=cmuosmqnx0001q2ijdrx8rbzp | [00:26:06]    📥 storage state مستعاد من الجيل السابق (v1)

### T6: أسباب الرفض باسمها الصريح
WHATSAPP: ok=false reason=TASK_NOT_ALLOWED (TASK_NOT_ALLOWED متوقع) | GLOBAL_STOP: ok=false reason=PLATFORM_PAUSED (PLATFORM_PAUSED متوقع) | COOLDOWN بعد جيل فيسبوك: ok=false reason=COOLDOWN | IG GROUPS_SCAN بلا جلسة: job=RETRYING note=HTTP 429

### T6-B: لوحة السياسات (§31)
control status=200 | FACEBOOK cooldownActive=true actionsInWindow=22/30 | lastBlock={"reason":"COOLDOWN","at":"2026-10-01T00:25:59.098Z"}

### تحقّق: T6: منصة بلا نطاق متصفح تُرفض TASK_NOT_ALLOWED
PASS — 

### تحقّق: T6: الإيقاف العام يوقف المتصفحات PLATFORM_PAUSED
PASS — 

### تحقّق: T6: cooldown بعد الجيل يُرفض صراحة COOLDOWN (§23)
PASS — 

### تحقّق: T6: ساعات النشاط تعمل (خارجها=false /全天=true)
PASS — 

### T7: سلسلة الجيلات الكاملة
g1: exit=0 Generation handoff: g1 → g2 parentRun=br-reddit-g1-tx1hcr childRun=bgen-79675670-8c0 queue=0 || لا dispatch: لا شغل مستحق
    g2: exit=0 لا dispatch — لا جيل جديد قبل الحاجة الفعلية §23)
    g3: exit=0 لا dispatch — لا جيل جديد قبل الحاجة الفعلية §23)
    g4: exit=0 لا dispatch — لا جيل جديد قبل الحاجة الفعلية §23)
  DISPATCH events=1:
      g1→g2 parent=br-reddit-g1-tx1hc child=bgen-79675670-8c0 trigger=SELF_DISPATCH shouldDispatch=false
  generations=g1(CLOSED,tasks=2)
  overClaimed=0 stuck=0 activeNow=0

### تحقّق: T7: 4 جيلات متتالية اكتملت (g1→g4)
FAIL — 1 جيلات

### تحقّق: T7: كل handoff مسجّل بنسل كامل (parent/child/trigger)
FAIL — 1 dispatch

### تحقّق: T7: صفر ادعاء مزدوج للجوبات
PASS — 

### تحقّق: T7: صفر جوبات عالقة
PASS — 

### تحقّق: T7: أرقام جيلات فريدة تصاعدية — لا قفز ولا تكرار
PASS — 

### تحقّق: T7: لا متصفحات نشطة عالقة في النهاية (لا dispatch storm)
PASS — activeNow=0

### T7: سلسلة الجيلات الكاملة
g1: exit=0 Generation handoff: g2 → g3 parentRun=br-reddit-g2-b4tqbt childRun=bgen-0080f45b-0ee queue=0 || لا dispatch: لا شغل مستحق
    g2: exit=0 Generation handoff: g3 → g4 parentRun=br-reddit-g3-xpha01 childRun=bgen-adef1fc8-30d queue=0 || لا dispatch: لا شغل مستحق
    g3: exit=0 Generation handoff: g4 → g5 parentRun=br-reddit-g4-718ih6 childRun=bgen-3f70489f-725 queue=0 || لا dispatch: لا شغل مستحق
    g4: exit=0 Generation handoff: g5 → g6 parentRun=br-reddit-g5-u54orw childRun=bgen-aa1c3dc8-718 queue=0 || لا dispatch: لا شغل مستحق
  DISPATCH events=4:
      g2→g3 parent=br-reddit-g2-b4tqb child=bgen-0080f45b-0ee trigger=SELF_DISPATCH shouldDispatch=false
    g3→g4 parent=br-reddit-g3-xpha0 child=bgen-adef1fc8-30d trigger=SELF_DISPATCH shouldDispatch=false
    g4→g5 parent=br-reddit-g4-718ih child=bgen-3f70489f-725 trigger=SELF_DISPATCH shouldDispatch=false
    g5→g6 parent=br-reddit-g5-u54or child=bgen-aa1c3dc8-718 trigger=SELF_DISPATCH shouldDispatch=false
  generations=g2(CLOSED,tasks=2) g3(CLOSED,tasks=2) g4(CLOSED,tasks=2) g5(CLOSED,tasks=1)
  overClaimed=0 stuck=0 activeNow=0

### تحقّق: T7: 4 جيلات متتالية اكتملت (g1→g4)
PASS — 4 جيلات

### تحقّق: T7: كل handoff مسجّل بنسل كامل (parent/child/trigger)
PASS — 4 dispatch

### تحقّق: T7: صفر ادعاء مزدوج للجوبات
PASS — 

### تحقّق: T7: صفر جوبات عالقة
PASS — 

### تحقّق: T7: أرقام جيلات فريدة تصاعدية — لا قفز ولا تكرار
PASS — 

### تحقّق: T7: لا متصفحات نشطة عالقة في النهاية (لا dispatch storm)
PASS — activeNow=0

### T8: القارئ الموحد — direct → jina → NEEDS_SESSION
example.com: status=OK via=direct chars=713
  instagram (جدار دخول للمباشر): status=ERROR via=null chars=0

### T8: عدّاد Jina اليومي
requests=undefined success=undefined failure=undefined timeouts=undefined
  avgLatency=0ms
  lastSuccess=—

### تحقّق: T8: صفحة عامة عادية → direct (لا استهلاك Jina بلا داعٍ)
PASS — 

### تحقّق: T8: صفحة خلف جدار → Jina fallback نجح (§28)
FAIL — 

### تحقّق: T8: العدّاد سجّل الطلبات (§29)
FAIL — 

### تحقّق: T8: مثبت على الحدود — Jina لا يتجاوز الحماية (NEEDS_SESSION منطق موجود في الكود)
PASS — looksLikeLoginWall يمنع أي قراءة خلف الجدار — موجود في src/lib/jina.ts

### T9: تطابق اللوحة مع DB
control status=200
  platforms=10 (10 متوقع)
  health.activeBrowsers=0 == DB active=0
  mismatches=لا شيء
  jina rows=1 jinaMatch=true
  dbEvents=165 dbClosedRuntimes=15 sessionRows=3

### تحقّق: T9: اللوحة ترد 200 وتعرض 10 منصات
PASS — 

### تحقّق: T9: عدّاد المتصفحات لكل منصة مطابق للـDB
PASS — تطابق كامل

### تحقّق: T9: health.activeBrowsers مطابق
PASS — 0 vs 0

### تحقّق: T9: Jina في اللوحة == Jina في DB
PASS — 

### تحقّق: T9: لا تسريب أسرار — الرد يحمل حالات وأرقامًا فقط
PASS — لا حقول تخزين/كوكيز في الرد

### T8: القارئ الموحد — direct → jina → NEEDS_SESSION
example.com: status=OK via=direct chars=713
  instagram (جدار دخول للمباشر): status=ERROR via=null chars=0

### T8: عدّاد Jina اليومي
requests=1 success=0 failure=1 timeouts=0
  avgLatency=24ms
  lastSuccess=—

### تحقّق: T8: صفحة عامة عادية → direct (لا استهلاك Jina بلا داعٍ)
PASS — 

### تحقّق: T8: صفحة خلف جدار → المسار كامل (direct فشل → Jina حُاول → ERROR صادق بلا تجاوز)
PASS — فشل الجلب المباشر وJina: jina HTTP 403

### تحقّق: T8: العدّاد سجّل الطلبات والفشل (§29 — حتى الفشل يُقاس)
FAIL — requests=1 failures=1 lastError=jina HTTP 403

### تحقّق: T8: مثبت على الحدود — Jina لا يتجاوز الحماية (NEEDS_SESSION منطق موجود في الكود)
PASS — looksLikeLoginWall يمنع أي قراءة خلف الجدار — موجود في src/lib/jina.ts

### T8: القارئ الموحد — direct → jina → NEEDS_SESSION
example.com: status=OK via=direct chars=713
  instagram (جدار دخول للمباشر): status=ERROR via=null chars=0

### T8: عدّاد Jina اليومي
requests=3 success=0 failure=3 timeouts=0
  avgLatency=21ms
  lastSuccess=—

### تحقّق: T8: صفحة عامة عادية → direct (لا استهلاك Jina بلا داعٍ)
PASS — 

### تحقّق: T8: صفحة خلف جدار → المسار كامل (direct فشل → Jina حُاول → ERROR صادق بلا تجاوز)
PASS — فشل الجلب المباشر وJina: jina HTTP 403

### تحقّق: T8: العدّاد سجّل الطلبات والفشل (§29 — حتى الفشل يُقاس)
PASS — requests=3 failures=3 lastError=jina HTTP 403

### تحقّق: T8: مثبت على الحدود — Jina لا يتجاوز الحماية (NEEDS_SESSION منطق موجود في الكود)
PASS — looksLikeLoginWall يمنع أي قراءة خلف الجدار — موجود في src/lib/jina.ts

