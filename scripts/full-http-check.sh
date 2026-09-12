#!/bin/bash
# الاختبار الشامل عبر HTTP — أمر واحد مكتفي ذاتيًا
# يشغل السيرفر → ينتظر → يختبر كل المسارات والميزات → يحفظ النتيجة في tool-results/system-check.txt
cd /home/z/my-project
mkdir -p tool-results
OUT=tool-results/system-check.txt
> "$OUT"

TOKEN=$(bun -e "
import { signToken } from './src/lib/auth'
import { db } from './src/lib/db'
const u = await db.user.findFirst({ where: { role: 'OWNER' }, select: { id: true } })
console.log(signToken({ sub: u.id }))
process.exit(0)" 2>/dev/null | tail -1)

COOKIE="leados_session=$TOKEN"
INGEST_KEY="INGEST_9a6214714acd0be22d8460d696355a75"

# 1) تشغيل السيرفر
setsid bash -c 'exec /home/z/my-project/node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1' < /dev/null > /dev/null 2>&1 &
for i in $(seq 1 30); do
  sleep 2
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ --max-time 10 2>/dev/null)
  if [ "$code" = "200" ]; then echo "SERVER: UP (after $((i*2))s)" >> "$OUT"; break; fi
done

log() { echo "$1" | tee -a "$OUT"; }
t() { # t <name> <method> <url> [data] [extra_headers]
  local name="$1" method="$2" url="$3" data="$4" extra="$5"
  if [ -n "$data" ]; then
    code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X "$method" -b "$COOKIE" -H "Content-Type: application/json" ${extra:+-H "$extra"} -d "$data" "$url" --max-time 60)
  else
    code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X "$method" -b "$COOKIE" ${extra:+-H "$extra"} "$url" --max-time 60)
  fi
  log "  $name → $code"
}

log "═══ 1) المسارات الأساسية (مصادقة OWNER) ═══"
for ep in overview leads analytics sources tasks feed alerts rules pipeline research; do
  t "GET /api/$ep" GET "http://localhost:3000/api/$ep"
done

log "═══ 2) مسارات الأيجنت ═══"
t "GET /api/agent/runs" GET "http://localhost:3000/api/agent/runs"
t "GET /api/agent/memory (بحث في الذاكرة)" GET "http://localhost:3000/api/agent/memory?q=%D8%B5%D9%8A%D8%AF%D9%84%D9%8A%D8%A7%D8%AA%20%D8%A7%D9%84%D9%85%D8%B9%D8%A7%D8%AF%D9%8A"

log "═══ 3) AI Commander — الشات بالأدوات ═══"
t "POST /api/chat (رسالة جديدة)" POST "http://localhost:3000/api/chat" '{"message":"كم ليد عندي في القاعدة دلوقتي؟","workspaceId":"cmtyimk8f0002oonlxid1k38p"}'
log "    الرد: $(head -c 220 /tmp/resp.json 2>/dev/null)"

log "═══ 4) المهام المجدولة cron/tick ═══"
t "POST /api/cron/tick (بجلسة)" POST "http://localhost:3000/api/cron/tick?max=3"
log "    النتيجة: $(head -c 250 /tmp/resp.json 2>/dev/null)"

log "═══ 5) Webhook الاستقبال (الووركر الخارجي) ═══"
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X POST "http://localhost:3000/api/ingest/webhook" -H "Content-Type: application/json" -d '{"source":"test","platform":"GOOGLE_MAPS","items":[]}' --max-time 30)
log "  بدون مفتاح → $code (متوقع 401)"
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X POST "http://localhost:3000/api/ingest/webhook" -H "Content-Type: application/json" -H "x-api-key: $INGEST_KEY" -d '{"source":"system-check","platform":"GOOGLE_MAPS","items":[{"title":"صيدلية اختبار النظام","url":"https://maps.google.com/?cid=999999991","phone":"01000000001","address":"المعادي، القاهرة"}]}' --max-time 30)
log "  POST حقيقي بمفتاح → $code"
log "    الرد: $(head -c 250 /tmp/resp.json 2>/dev/null)"

log "═══ 6) الحماية بدون جلسة ═══"
code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/leads" --max-time 15)
log "  GET /api/leads بدون توكن → $code (متوقع 401)"
code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/cron/tick" --max-time 15)
log "  GET /api/cron/tick بدون سر → $code (متوقع 401)"

echo "DONE" >> "$OUT"
echo "=== النتيجة الكاملة ==="
cat "$OUT"
