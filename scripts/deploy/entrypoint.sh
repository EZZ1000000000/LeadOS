#!/usr/bin/env bash
# LeadOS — نقطة دخول الحاوية
# بيشغّل: supervisor (خادم + نبضة + باك أب داخلي، إصلاح ذاتي كل 60 ثانية)
#        + external-backup-loop (نسخ القاعدة كل 30 دقيقة في مجلد الـvolume)
# docker restart: unless-stopped = لو الحاوية نفسها ماتت ترجع تلقائياً
set -e
cd /app
mkdir -p db/backups logs /app/backups-external

# سكربتات النبضة والباك أب شغالة جوا الحاوية مباشرة
bash scripts/prod-supervisor.sh &
SUP_PID=$!
bash scripts/external-backup-loop.sh &
EXT_PID=$!

# لو أي حلقة رئيسية ماتت → الحاوية تخرج → docker يعيدها فوراً
wait -n "$SUP_PID" "$EXT_PID"
exit 1
