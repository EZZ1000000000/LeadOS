#!/bin/bash
# LeadOS — ضمان إن السيرفر المحلي شغال (بيتصل بيه، ولو مش شغال بيشغله ويستنى)
# الاستخدام: scripts/dev-up.sh [مهلة-ثواني]
URL=${DEV_URL:-http://localhost:3000}
WAIT=${1:-80}

if curl -s -m 4 -o /dev/null "$URL"; then
  echo "[dev-up] السيرفر شغال ✅"
  exit 0
fi

echo "[dev-up] السيرفر مش شغال — بيشغّل..."
cd /home/z/my-project || exit 1
NODE_OPTIONS="--max-old-space-size=1024" nohup bun run dev > /tmp/leados-dev.log 2>&1 &
disown 2>/dev/null || true

for i in $(seq 1 $((WAIT / 2))); do
  if curl -s -m 4 -o /dev/null "$URL"; then
    echo "[dev-up] السيرفر جهز بعد $((i * 2)) ثانية ✅"
    exit 0
  fi
  sleep 2
done

echo "[dev-up] فشل تشغيل السيرفر خلال ${WAIT}ث — شوف /tmp/leados-dev.log"
tail -5 /tmp/leados-dev.log
exit 1
