#!/bin/bash
# نبضة مؤقتة كل 10 دقائق — حتى ما المستخدم يرفع سقف المودال أو يعمل cron خارجي
ALT=$(grep "^CRON_SECRET_ALT=" /home/z/my-project/scripts/deploy/.tokens | cut -d= -f2)
while true; do
  R=$(curl -s --max-time 170 -X POST "https://leados-v2.vercel.app/api/cron/tick?max=1" -H "x-cron-secret: $ALT")
  echo "$(date -u '+%H:%M:%S') $R" | head -c 300; echo
  sleep 600
done
