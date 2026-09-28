#!/bin/bash
# حلقة إعادة نشر تلقائية — كل 15 دقيقة تمسح البلوكات وتحاول النشر
# توقف أول ما deployment يوصل READY
source /home/z/my-project/scripts/deploy/.tokens 2>/dev/null || source /home/z/my-project/.secrets-local/deploy-tokens
VT="${VERCEL_TOKEN:?VERCEL_TOKEN required}"
LOG=/home/z/my-project/.zscripts/deploy-loop.log
echo "[$(date +%H:%M)] deploy loop started" >> $LOG

for attempt in $(seq 1 12); do
  # نظف البلوكات القديمة
  for D in $(curl -s -H "Authorization: Bearer $VT" "https://api.vercel.com/v6/deployments?projectId=prj_t6eWDN0XUg5RyLJLFCXpHRmjwpbC&limit=6" | python3 -c "
import sys, json
for d in json.load(sys.stdin).get('deployments', []):
    if d.get('readyState') == 'BLOCKED': print(d['uid'])" 2>/dev/null); do
    curl -s -X DELETE -H "Authorization: Bearer $VT" "https://api.vercel.com/v13/deployments/$D" > /dev/null
    echo "[$(date +%H:%M)] deleted blocked $D" >> $LOG
  done
  sleep 10
  # حاول النشر
  cd /home/z/my-project
  OUT=$(bunx vercel deploy --prod --token $VT --yes --force 2>&1 | tail -3)
  echo "[$(date +%H:%M)] attempt $attempt: $OUT" >> $LOG
  UID_=$(echo "$OUT" | grep -oE "dpl_[A-Za-z0-9]+" | head -1)
  [ -z "$UID_" ] && UID_=$(curl -s -H "Authorization: Bearer $VT" "https://api.vercel.com/v6/deployments?projectId=prj_t6eWDN0XUg5RyLJLFCXpHRmjwpbC&limit=1" | python3 -c "import sys,json; print(json.load(sys.stdin)['deployments'][0]['uid'])" 2>/dev/null)
  sleep 30
  ST=""
  for poll in 1 2 3 4 5 6 7 8; do
    ST=$(curl -s -H "Authorization: Bearer $VT" "https://api.vercel.com/v13/deployments/$UID_" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('readyState'))" 2>/dev/null)
    [ "$ST" = "READY" ] || [ "$ST" = "ERROR" ] && break
    sleep 40
  done
  echo "[$(date +%H:%M)] attempt $attempt final: $ST" >> $LOG
  if [ "$ST" = "READY" ]; then echo "[$(date +%H:%M)] ✅ DEPLOY SUCCESS $UID_" >> $LOG; exit 0; fi
  sleep 600 # استنى 10 دقايق قبل المحاولة التالية
done
echo "[$(date +%H:%M)] ❌ deploy loop exhausted" >> $LOG
