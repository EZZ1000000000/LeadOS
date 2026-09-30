#!/bin/bash
# مراقبة نشر Vercel — ينتظر نشرة جديدة (أحدث من لحظة تشغيل السكريبت) ويبث حالتها
TOKEN=$(cat ~/.vercel_token)
PROJECT=prj_Kv9czxsvv3z84XE2JEaE1UsgtGN4
CUTOFF=$(date +%s%3N)
echo "watching for deployments created after $CUTOFF"
for i in $(seq 1 28); do
  RESP=$(curl -s -m 15 -H "Authorization: Bearer $TOKEN" "https://api.vercel.com/v6/deployments?projectId=$PROJECT&limit=1")
  LINE=$(echo "$RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
x = (d.get('deployments') or [{}])[0]
print(x.get('readyState','?'), x.get('uid','?'), x.get('createdAt',0), sep='|')
")
  ST=$(echo "$LINE" | cut -d'|' -f1)
  UID_=$(echo "$LINE" | cut -d'|' -f2)
  CREATED=$(echo "$LINE" | cut -d'|' -f3)
  if [ "$CREATED" -lt "$CUTOFF" ]; then
    echo "$(date +%H:%M:%S) newest is old ($ST $UID_) — waiting for workflow to create new deployment..."
  else
    echo "$(date +%H:%M:%S) NEW DEPLOY $ST $UID_"
    if [ "$ST" = "READY" ]; then echo "DEPLOY_READY"; exit 0; fi
    if [ "$ST" = "BLOCKED" ] || [ "$ST" = "ERROR" ] || [ "$ST" = "CANCELED" ]; then echo "DEPLOY_FAILED:$ST"; exit 1; fi
  fi
  sleep 20
done
echo "TIMEOUT"
exit 2
