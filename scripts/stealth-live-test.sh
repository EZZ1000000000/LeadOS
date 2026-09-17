#!/bin/bash
# LeadOS — اختبار حي شامل لستيلث Camoufox (أمر واحد ذاتي الكفاية)
cd /home/z/my-project
mkdir -p tool-results download/stealth
OUT=tool-results/stealth-test.txt
: > "$OUT"

# 1) تشغيل السيرفر
nohup npx next dev > dev.log 2>&1 &
echo "→ next dev starting..." >> "$OUT"
for i in $(seq 1 40); do
  sleep 3
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 8 http://127.0.0.1:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
done
echo "homepage: $code" >> "$OUT"

# 2) تسجيل الدخول
curl -s -c /tmp/leados-cookies.txt -X POST http://127.0.0.1:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@leados.ai","password":"123456"}' > /dev/null
echo "login: $(curl -s -b /tmp/leados-cookies.txt -m 10 http://127.0.0.1:3000/api/me | head -c 80)" >> "$OUT"
echo "login done" >> "$OUT"

# 3) حالة الستيلث قبل التشغيل
echo "── health before ──" >> "$OUT"
curl -s -b /tmp/leados-cookies.txt -m 15 http://127.0.0.1:3000/api/agent/browse >> "$OUT"; echo >> "$OUT"

# 4) تصفح example.com (يشغّل الخدمة تلقائيًا — أول إطلاق قد ياخد حتى 90 ثانية)
echo "── goto example.com (auto-spawn) ──" >> "$OUT"
curl -s -b /tmp/leados-cookies.txt -m 240 -X POST http://127.0.0.1:3000/api/agent/browse \
  -H 'Content-Type: application/json' \
  -d '{"action":"goto","url":"https://example.com","screenshot":true,"save":true}' | head -c 400 >> "$OUT"; echo >> "$OUT"

# 5) حالة الستيلث بعد التشغيل
echo "── health after ──" >> "$OUT"
curl -s -b /tmp/leados-cookies.txt -m 15 http://127.0.0.1:3000/api/agent/browse >> "$OUT"; echo >> "$OUT"

# 6) تصفح تليجرام حقيقي + استخراج عناصر
echo "── goto t.me/s/telegram ──" >> "$OUT"
curl -s -b /tmp/leados-cookies.txt -m 240 -X POST http://127.0.0.1:3000/api/agent/browse \
  -H 'Content-Type: application/json' \
  -d '{"action":"goto","url":"https://t.me/s/telegram","scroll_times":1}' | head -c 300 >> "$OUT"; echo >> "$OUT"
echo "── extract .tgme_widget_message_text ──" >> "$OUT"
curl -s -b /tmp/leados-cookies.txt -m 60 -X POST http://127.0.0.1:3000/api/agent/browse \
  -H 'Content-Type: application/json' \
  -d '{"action":"extract","selector":".tgme_widget_message_text","limit":5}' | head -c 500 >> "$OUT"; echo >> "$OUT"

# 7) إضافة جروب فيسبوك حقيقي ومسحه (المسار: مباشر → ستيلث)
echo "── add FB group ──" >> "$OUT"
curl -s -b /tmp/leados-cookies.txt -m 30 -X POST http://127.0.0.1:3000/api/groups \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.facebook.com/groups/cairocaffeowners","name":"أصحاب الكافيهات","segment":"CARDS"}' | head -c 300 >> "$OUT"; echo >> "$OUT"
GID=$(curl -s -b /tmp/leados-cookies.txt -m 15 "http://127.0.0.1:3000/api/groups?panel=CARDS" | python3 -c "import json,sys; d=json.load(sys.stdin); print([g['id'] for g in d['groups'] if 'caffe' in g.get('externalId','')][0])" 2>/dev/null)
echo "groupId: $GID" >> "$OUT"
echo "── scan FB group (direct→stealth) ──" >> "$OUT"
curl -s -b /tmp/leados-cookies.txt -m 300 -X POST http://127.0.0.1:3000/api/groups/scan \
  -H 'Content-Type: application/json' -d "{\"groupId\":\"$GID\"}" | head -c 600 >> "$OUT"; echo >> "$OUT"

# 8) سكرين شوت محفوظة؟
echo "── saved screenshots ──" >> "$OUT"
ls -la download/stealth/ 2>/dev/null | tail -3 >> "$OUT"
tail -4 /tmp/camoufox.log >> "$OUT" 2>/dev/null
echo "TEST COMPLETE" >> "$OUT"
