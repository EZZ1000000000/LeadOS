#!/bin/bash
# التحقق الحي الشامل — كل مميزات LeadOS على السيرفر العايش (:3000)
# بدون تشغيل سيرفر جديد — النتيجة في tool-results/live-features.txt
cd /home/z/my-project
mkdir -p tool-results
OUT=tool-results/live-features.txt
> "$OUT"

TOKEN=$(bun -e "
import { signToken } from './src/lib/auth'
import { db } from './src/lib/db'
const u = await db.user.findFirst({ where: { role: 'OWNER' }, select: { id: true } })
console.log(signToken({ sub: u.id }))
process.exit(0)" 2>/dev/null | tail -1)

COOKIE="leados_session=$TOKEN"
INGEST_KEY=$(grep -E '^INGEST_API_KEY=' .env | cut -d= -f2-)
CRON_SECRET=$(grep -E '^CRON_SECRET=' .env | cut -d= -f2-)
BASE="http://localhost:3000"

log() { echo "$1" | tee -a "$OUT"; }
t() { # t <name> <method> <url> [data] [extra_headers]
  local name="$1" method="$2" url="$3" data="$4" extra="$5"
  if [ -n "$data" ]; then
    code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X "$method" -b "$COOKIE" -H "Content-Type: application/json" ${extra:+-H "$extra"} -d "$data" "$url" --max-time 90)
  else
    code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X "$method" -b "$COOKIE" ${extra:+-H "$extra"} "$url" --max-time 90)
  fi
  log "  $name → $code"
}

log "═══ 0) السيرفر الحي ═══"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/" --max-time 10)
log "  GET / → $code"

log "═══ 1) المسارات الأساسية (مصادقة OWNER) ═══"
for ep in overview leads analytics sources tasks feed alerts rules pipeline research; do
  t "GET /api/$ep" GET "$BASE/api/$ep"
done

log "═══ 2) حالة مزودي AI (Gemini مفعّل؟) ═══"
t "GET /api/settings/ai" GET "$BASE/api/settings/ai"
log "    $(head -c 200 /tmp/resp.json 2>/dev/null)"

log "═══ 3) مسارات الأيجنت ═══"
t "GET /api/agent/runs" GET "$BASE/api/agent/runs"
t "GET /api/agent/memory (بحث)" GET "$BASE/api/agent/memory?q=%D8%B5%D9%8A%D8%AF%D9%84%D9%8A%D8%A7%D8%AA"

log "═══ 4) AI Commander — شات بأداة (عد الليدز) ═══"
t "POST /api/chat" POST "$BASE/api/chat" '{"message":"كم ليد عندي في القاعدة دلوقتي؟"}'
log "    الرد: $(head -c 300 /tmp/resp.json 2>/dev/null)"

log "═══ 5) الأيجنت الحي — هدف جديد كامل ═══"
t "POST /api/agent/run (جيمات التجمع الخامس)" POST "$BASE/api/agent/run" '{"objective":"عيادات أسنان التجمع الخامس أرقام","platforms":["WEB"]}'

log "═══ 6) tick المجدول (بالسر الخارجي — زي cron-job.org) ═══"
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X POST "$BASE/api/cron/tick?max=3&secret=$CRON_SECRET" --max-time 90)
log "  POST /api/cron/tick?secret=... → $code"
log "    $(head -c 250 /tmp/resp.json 2>/dev/null)"

log "═══ 7) Webhook الاستقبال ═══"
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X POST "$BASE/api/ingest/webhook" -H "Content-Type: application/json" -d '{"source":"t","platform":"GOOGLE_MAPS","items":[]}' --max-time 30)
log "  بدون مفتاح → $code (متوقع 401)"
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X POST "$BASE/api/ingest/webhook" -H "Content-Type: application/json" -H "x-api-key: $INGEST_KEY" -d '{"source":"live-check","platform":"GOOGLE_MAPS","items":[{"name":"عيادة أسنان ليفينج ويلز","url":"https://maps.google.com/?cid=777777777","phone":"01000000077","address":"التجمع الخامس، القاهرة"}]}' --max-time 30)
log "  POST بمفتاح → $code"
log "    $(head -c 250 /tmp/resp.json 2>/dev/null)"

log "═══ 8) الحماية بدون جلسة ═══"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/leads" --max-time 15)
log "  /api/leads بلا جلسة → $code (متوقع 401)"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cron/tick" --max-time 15)
log "  /api/cron/tick بلا سر → $code (متوقع 401)"

log "═══ 9) تدفق المصادقة register→login ═══"
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X POST "$BASE/api/auth/register" -H "Content-Type: application/json" -d '{"name":"اختبار حي","email":"live-test@leados.local","password":"test123456"}' --max-time 30)
log "  POST /api/auth/register → $code"
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"live-test@leados.local","password":"test123456"}' --max-time 30)
log "  POST /api/auth/login → $code"
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"live-test@leados.local","password":"wrong-pass"}' --max-time 30)
log "  POST /api/auth/login (باسورد غلط) → $code (متوقع 401)"

log "═══ 10) إحصائيات القاعدة النهائية ═══"
bun -e "
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const leads = await db.lead.count();
const hot = await db.lead.count({ where: { temperature: 'HOT' } });
const phones = await db.lead.count({ where: { phone: { not: null } } });
const runs = await db.agentRun.count();
const mem = await db.searchMemory.count();
const aiRuns = await db.aiRun.count();
console.log(JSON.stringify({ leads, hot, phones, agentRuns: runs, memories: mem, aiRuns }));
await db.\$disconnect();
" 2>/dev/null | tee -a "$OUT"

# تنظيف مستخدم الاختبار
bun -e "
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const u = await db.user.findUnique({ where: { email: 'live-test@leados.local' } });
if (u) {
  await db.workspaceMember.deleteMany({ where: { userId: u.id } });
  const ws = await db.workspace.findFirst({ where: { name: { contains: 'live' } } });
  await db.user.delete({ where: { id: u.id } });
  if (ws) await db.workspace.delete({ where: { id: ws.id } }).catch(() => undefined);
  console.log('CLEANUP: test user removed');
}
await db.\$disconnect();
" 2>/dev/null | tee -a "$OUT"

echo "DONE" >> "$OUT"
echo "════════ النتيجة ════════"
cat "$OUT"
