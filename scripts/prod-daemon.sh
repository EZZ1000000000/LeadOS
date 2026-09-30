#!/bin/bash
# LeadOS — حارس الإنتاج الموحد (بديل GitHub Actions الميت نهائيًا):
#   1) نبضة أوركستراتور كل 10 دقائق
#   2) نشر تلقائي على Vercel عند وصول كوميت جديد إلى origin/main
# يقرأ كل الأسرار من ملف واحد: .env.keys
cd /home/z/my-project || exit 1
set -a; source .env.keys; set +a
BASE="$DASHBOARD_URL"
while true; do
  # ── 1) النبضة ──
  code=$(curl -s -o /tmp/daemon-tick.json -w "%{http_code}" --max-time 110 \
    -X POST "${BASE}/api/cron/tick?max=3&secret=${CRON_SECRET}")
  echo "$(date '+%m-%d %H:%M') tick -> $code $(head -c 90 /tmp/daemon-tick.json 2>/dev/null)" >> db/backups/daemon.log

  # ── 2) النشر التلقائي ──
  timeout 30 git fetch origin main -q 2>/dev/null
  REMOTE=$(git rev-parse origin/main 2>/dev/null)
  LOCAL=$(git rev-parse main 2>/dev/null)
  DEPLOYED=$(cat .last-deployed-sha 2>/dev/null || echo none)
  if [ -n "$REMOTE" ] && [ "$REMOTE" = "$LOCAL" ] && [ "$REMOTE" != "$DEPLOYED" ]; then
    echo "$(date '+%m-%d %H:%M') new commit detected: ${REMOTE:0:7} — deploying..." >> db/backups/daemon.log
    if npx --yes vercel@59 deploy --prod --yes --token "$VERCEL_TOKEN" > /tmp/daemon-deploy.log 2>&1; then
      echo "$REMOTE" > .last-deployed-sha
      echo "$(date '+%m-%d %H:%M') deploy OK" >> db/backups/daemon.log
    else
      echo "$(date '+%m-%d %H:%M') deploy FAILED (see /tmp/daemon-deploy.log)" >> db/backups/daemon.log
    fi
  fi
  sleep 600
done
