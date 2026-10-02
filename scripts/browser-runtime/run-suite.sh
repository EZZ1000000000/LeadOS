#!/bin/bash
# LeadOS — Browser Runtime Suite Runner (e2e + live runner في جلسة واحدة)
# البيئة تقتل الـbackground processes بين الاستدعاءات — لذلك: سيرفر + اختبارات في استدعاء واحد.
set -u
cd /home/z/my-project

SECRET=$(grep '^CRON_SECRET=' .env.local | cut -d= -f2)
export LEADOS_RUNNER_SECRET="$SECRET"
export LEADOS_BASE_URL="http://localhost:3000"

echo "══ (1/5) تشغيل السيرفر ══"
npx next dev -p 3000 > dev-suite.log 2>&1 &
SERVER_PID=$!
UP=0
for i in $(seq 1 40); do
  if curl -sS -m 3 http://localhost:3000/api -o /dev/null 2>/dev/null; then UP=1; break; fi
  sleep 2
done
if [ "$UP" != "1" ]; then echo "❌ السيرفر ما قام"; tail -20 dev-suite.log; kill $SERVER_PID 2>/dev/null; exit 1; fi
echo "✅ سيرفر حي (pid=$SERVER_PID)"

echo "══ (2/5) حزمة البروتوكول T1..T20 ══"
node scripts/browser-runtime/e2e-tests.mjs
SUITE_RC=$?
echo "── نتيجة الحزمة: rc=$SUITE_RC ──"

echo "══ (3/5) تشغيل حي حقيقي — runner بـchromium (الجيل 1) ══"
# جوبات عامة حقيقية + جروب فيسبوك حقيقي للمسار الموثق
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const ws = await p.workspace.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
  for (const url of ['https://example.com/', 'https://www.wikipedia.org/']) {
    await p.job.create({ data: { workspaceId: ws.id, type: 'BROWSER_SCAN', priority: 60,
      payload: { platform: 'FACEBOOK', task: 'PUBLIC_FETCH', url, sessionRequired: false, seededBy: 'live-run' } } });
  }
  console.log('live jobs enqueued for', ws.id);
  await p.\$disconnect();
})();
"
LEADOS_PLATFORM=FACEBOOK LEADOS_RUNNER_ID=live-g1 node scripts/browser-runtime/runner.mjs 2>&1 | tee /tmp/live-g1.log | tail -25

echo "══ (4/5) الجيل الثاني — استعادة الجلسة (استمرارية بين runner جديد) ══"
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const ws = await p.workspace.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
  for (const url of ['https://www.wikipedia.org/', 'https://example.com/again']) {
    await p.job.create({ data: { workspaceId: ws.id, type: 'BROWSER_SCAN', priority: 60,
      payload: { platform: 'FACEBOOK', task: 'PUBLIC_FETCH', url, sessionRequired: false, seededBy: 'live-run-g2' } } });
  }
  await p.\$disconnect();
})();
"
LEADOS_PLATFORM=FACEBOOK LEADOS_RUNNER_ID=live-g2 node scripts/browser-runtime/runner.mjs 2>&1 | tee /tmp/live-g2.log | tail -25

echo "══ (5/5) اختبار انهيار حقيقي: kill -9 أثناء مهمة ثم استعادة ══"
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const ws = await p.workspace.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
  await p.job.create({ data: { workspaceId: ws.id, type: 'BROWSER_SCAN', priority: 80,
    payload: { platform: 'FACEBOOK', task: 'PUBLIC_FETCH', url: 'https://www.wikipedia.org/', sessionRequired: false, seededBy: 'live-crash' } } });
  await p.\$disconnect();
})();
"
LEADOS_PLATFORM=FACEBOOK LEADOS_RUNNER_ID=live-crash node scripts/browser-runtime/runner.mjs > /tmp/live-crash.log 2>&1 &
CRASH_PID=$!
sleep 18                       # اتركه يفتح المتصفح ويكتب checkpoint ويبدأ أول مهمة
kill -9 $CRASH_PID 2>/dev/null
echo "💀 الـrunner قُتل أثناء التشغيل (kill -9 بعد 18 ثانية)"
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  await p.browserRuntime.updateMany({ where: { status: { in: ['READY','BUSY'] } }, data: { lastHeartbeat: new Date(Date.now() - 3*60_000) } });
  console.log('heartbeat أُشيخ — المتصفح يبدو مفقودًا');
  await p.\$disconnect();
})();
"
sleep 3
LEADOS_PLATFORM=FACEBOOK LEADOS_RUNNER_ID=live-recover node scripts/browser-runtime/runner.mjs 2>&1 | tee /tmp/live-recover.log | tail -25
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const lost = await p.browserEvent.count({ where: { type: 'HEARTBEAT_LOST' } });
  const restored = await p.browserCheckpoint.count({ where: { status: 'RESTORED' } });
  console.log(\` Crash-recovery دليل قاعدي: HEARTBEAT_LOST=\${lost} checkpoint restored=\${restored}\`);
  await p.\$disconnect();
})();
"

echo "══ إيقاف السيرفر ══"
kill $SERVER_PID 2>/dev/null
pkill -f "next dev" 2>/dev/null
echo "══ انتهت الجلسة ══"
