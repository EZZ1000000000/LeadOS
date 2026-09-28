#!/bin/bash
# حلقة نشر prebuilt — تحاول كل 20 دقيقة أول ما قفل Vercel يرفع
# تنجح مرة واحدة وتوقف
source /home/z/my-project/scripts/deploy/.tokens 2>/dev/null || source /home/z/my-project/.secrets-local/deploy-tokens
VT="${VERCEL_TOKEN:?VERCEL_TOKEN required}"
LOG=/home/z/my-project/.zscripts/deploy-watch.log
cd /home/z/my-project

echo "[$(date +%d-%H:%M)] watcher started" >> "$LOG"

for attempt in $(seq 1 10); do
  OUT=$(bunx vercel deploy --prebuilt --prod --yes --token "$VT" 2>&1 | tail -2)
  UID_=$(curl -s -H "Authorization: Bearer $VT" "https://api.vercel.com/v6/deployments?projectId=prj_t6eWDN0XUg5RyLJLFCXpHRmjwpbC&limit=1" | python3 -c "import sys,json; print(json.load(sys.stdin)['deployments'][0]['uid'])" 2>/dev/null)
  echo "[$(date +%d-%H:%M)] attempt $attempt uid=$UID_ out: $(echo "$OUT" | head -c 120)" >> "$LOG"
  # راقب الحالة حتى 5 دقايق
  ST=""
  for poll in $(seq 1 6); do
    sleep 45
    ST=$(curl -s -H "Authorization: Bearer $VT" "https://api.vercel.com/v13/deployments/$UID_" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('readyState'))" 2>/dev/null)
    [ "$ST" = "READY" ] || [ "$ST" = "ERROR" ] && break
  done
  echo "[$(date +%d-%H:%M)] attempt $attempt => $ST" >> "$LOG"
  if [ "$ST" = "READY" ]; then
    # امسح أي بلوكات قديمة
    for D in $(curl -s -H "Authorization: Bearer $VT" "https://api.vercel.com/v6/deployments?projectId=prj_t6eWDN0XUg5RyLJLFCXpHRmjwpbC&limit=8" | python3 -c "
import sys, json
for d in json.load(sys.stdin).get('deployments', []):
    if d.get('readyState') == 'BLOCKED': print(d['uid'])" 2>/dev/null); do
      curl -s -X DELETE -H "Authorization: Bearer $VT" "https://api.vercel.com/v13/deployments/$D" > /dev/null
    done
    echo "[$(date +%d-%H:%M)] SUCCESS — new version live ✅" >> "$LOG"
    exit 0
  fi
  sleep 900 # 15 دقيقة بين المحاولات
done
echo "[$(date +%d-%H:%M)] watcher exhausted" >> "$LOG"
