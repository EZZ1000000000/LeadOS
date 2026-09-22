#!/usr/bin/env bash
# LeadOS — مشرف الإنتاج ذاتي الإصلاح
# بيفحص كل 60 ثانية: الخادم + النبضة + الباك أب — وأي خدمة تقع بيرجعها فوراً
# التشغيل: (setsid bash scripts/prod-supervisor.sh > /dev/null 2>&1 &)
cd /home/z/my-project || exit 1
mkdir -p db/backups logs

log() { echo "$(date '+%H:%M:%S') $1" >> logs/supervisor.log; }
log "═══ المشرف بدأ ═══"

while true; do
  # ─── 0) تحميل البيئة في كل دورة — أي تحديث مفاتيح بيتفعل مع أول إعادة تشغيل ───
  set -a
  source .env.local 2>/dev/null
  set +a
  export DATABASE_URL="file:/home/z/my-project/db/custom.db"
  export NODE_ENV=production
  export HOSTNAME=0.0.0.0
  export PORT=3000

  # ─── 1) خادم الإنتاج: استجابة فعلية مش مجرد عملية ───
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 http://localhost:3000/ 2>/dev/null)
  if [ "$code" != "200" ]; then
    log "⚠ الخادم مش راجع ($code) — إعادة تشغيل"
    pkill -9 -f "standalone/server.js" 2>/dev/null
    pkill -9 -f "next-server" 2>/dev/null
    sleep 2
    nohup node .next/standalone/server.js >> logs/server.log 2>&1 &
    log "✓ أمر التشغيل اتبعت"
  fi

  # ─── 2) حلقة النبضة (tick كل 10 دقايق) ───
  if ! pgrep -f "tick-loop.sh" > /dev/null; then
    log "⚠ النبضة واقعة — إعادة تشغيل"
    nohup bash scripts/tick-loop.sh > /dev/null 2>&1 &
  fi

  # ─── 3) حلقة الباك أب ───
  if ! pgrep -f "backup-loop.sh" > /dev/null; then
    if [ -f scripts/backup-loop.sh ]; then
      log "⚠ الباك أب واقع — إعادة تشغيل"
      nohup bash scripts/backup-loop.sh > /dev/null 2>&1 &
    fi
  fi

  sleep 60
done
