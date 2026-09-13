#!/bin/bash
# تحقق حي شامل من التطبيق المنشور على Vercel
BASE="${1:-https://leados-liard.vercel.app}"
CRON_SECRET=$(rg -v '^#' /home/z/my-project/.env | rg '^CRON_SECRET=' | head -1 | cut -d= -f2-)
INGEST_KEY=$(rg -v '^#' /home/z/my-project/.env | rg '^INGEST_API_KEY=' | head -1 | cut -d= -f2-)
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "✅ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "❌ $1"; }
check(){ local name="$1" expected="$2" actual="$3"; if [ "$actual" = "$expected" ]; then ok "$name ($actual)"; else bad "$name (متوقع $expected — فعلي $actual)"; fi; }

echo "=== الفحص الحي الشامل على $BASE ==="

# 1) الصفحة الرئيسية
c=$(curl -s -o /dev/null -w '%{http_code}' -m 30 "$BASE/")
check "الصفحة الرئيسية" 200 "$c"

# 2) دخول الأدمن
LOGIN=$(curl -s -m 30 -c /tmp/leados-prod-cookies.txt -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" -d '{"email":"admin@leados.ai","password":"123456"}' -w '\n%{http_code}')
code=$(echo "$LOGIN" | tail -1)
check "دخول admin@leados.ai" 200 "$code"
echo "$LOGIN" | head -1 | head -c 200; echo

# 3) الليدز (المفروض 10 من السيد)
LEADS=$(curl -s -m 30 -b /tmp/leados-prod-cookies.txt "$BASE/api/leads")
code=$(curl -s -o /dev/null -w '%{http_code}' -m 30 -b /tmp/leados-prod-cookies.txt "$BASE/api/leads")
check "GET /api/leads" 200 "$code"
echo "$LEADS" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    items=d if isinstance(d,list) else d.get('leads',d.get('items',[]))
    print(f'   عدد الليدز: {len(items)}')
except Exception as e: print('   parse err:', e)"

# 4) نظرة عامة
code=$(curl -s -o /dev/null -w '%{http_code}' -m 30 -b /tmp/leados-prod-cookies.txt "$BASE/api/overview")
check "GET /api/overview" 200 "$code"

# 5) إعدادات AI
AI=$(curl -s -m 30 -b /tmp/leados-prod-cookies.txt "$BASE/api/settings/ai")
echo "$AI" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(f\"   settings/ai → gemini={d.get('gemini')} mistral={d.get('mistral')} groq={d.get('groq')}\")" 2>/dev/null || echo "   $AI" | head -c 200

# 6) الشات بGemini حي
CHAT=$(curl -s -m 60 -b /tmp/leados-prod-cookies.txt -X POST "$BASE/api/ai/chat" \
  -H "Content-Type: application/json" -d '{"message":"كم عدد العملاء المحتملين في قاعدة البيانات؟ رد سطر واحد"}')
echo "$CHAT" | python3 -c "
import json,sys
d=json.load(sys.stdin)
txt=(d.get('reply') or d.get('message') or d.get('content') or '')[:120]
print('   الشات رد:', txt if txt else json.dumps(d)[:150])" 2>/dev/null || echo "   chat err: $(echo $CHAT|head -c 150)"

# 7) cron tick بالسر الخارجي
code=$(curl -s -o /tmp/tick.out -w '%{http_code}' -m 60 -X POST "$BASE/api/cron/tick?secret=$CRON_SECRET")
check "POST /api/cron/tick (سر خارجي)" 200 "$code"
head -c 150 /tmp/tick.out; echo

# 8) الويبهوك: بدون مفتاح (المفروض 401) وبالمفتاح
code=$(curl -s -o /dev/null -w '%{http_code}' -m 30 -X POST "$BASE/api/ingest/webhook" -H "Content-Type: application/json" -d '{"name":"اختبار"}')
check "webhook بدون مفتاح (رفض)" 401 "$code"
code=$(curl -s -o /tmp/hook.out -w '%{http_code}' -m 30 -X POST "$BASE/api/ingest/webhook" -H "Content-Type: application/json" -H "x-api-key: $INGEST_KEY" \
  -d '{"name":"فحص حي — مطعم تجريبي","source":"verification","phone":"+201000000001"}')
echo "   webhook بالمفتاح → $code: $(head -c 120 /tmp/hook.out)"

# 9) إنشاء ليد يدوي (بيان: الكود القديم ممكن يفشل هنا)
code=$(curl -s -o /tmp/manual.out -w '%{http_code}' -m 30 -b /tmp/leados-prod-cookies.txt -X POST "$BASE/api/leads" \
  -H "Content-Type: application/json" -d '{"name":"ليد فحص يدوي","phone":"+201000000002"}')
echo "   📋 إنشاء ليد يدوي → $code: $(head -c 120 /tmp/manual.out)"

# 10) حماية بدون جلسة
code=$(curl -s -o /dev/null -w '%{http_code}' -m 30 "$BASE/api/leads")
check "حماية /api/leads بدون جلسة" 401 "$code"

echo "=== النتيجة: نجح $PASS | فشل $FAIL ==="
