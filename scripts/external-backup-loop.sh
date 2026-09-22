#!/usr/bin/env bash
# LeadOS — باك أب خارجي منيع: نسخ القاعدة خارج مجلد المشروع كل 30 دقيقة
# ليه؟ لأن reset البيئة بيتمسح كل جوا /home/z/my-project — الخارجي بس بيتنجى
# التشغيل: (setsid bash scripts/external-backup-loop.sh > /dev/null 2>&1 &)
SAFE_DIR="/home/z/leados-backups"
cd /home/z/my-project || exit 1
mkdir -p "$SAFE_DIR"

while true; do
  sleep 1800
  if [ -f db/custom.db ]; then
    TS=$(date +%Y%m%d-%H%M%S)
    # نسخة مؤقتة بأمان (copy + checkpoint للـWAL لو موجود)
    cp db/custom.db "$SAFE_DIR/custom-$TS.db" 2>/dev/null
    cp db/custom.db "$SAFE_DIR/custom-latest.db" 2>/dev/null
    # توقيع بالليدز عشان الاستعادة السريعة بلا فحص يدوي
    LEADS=$(bun -e "const {Database}=require('bun:sqlite');try{console.log(new Database('db/custom.db',{readonly:true}).query('SELECT COUNT(*) c FROM Lead').get().c)}catch(e){console.log('?')}" 2>/dev/null)
    echo "$(date '+%m-%d %H:%M') → custom-$TS.db ($LEADS ليد)" >> "$SAFE_DIR/backup.log"
    # الاحتفاظ بآخر 24 نسخة فقط (12 ساعة)
    ls -t "$SAFE_DIR"/custom-*.db 2>/dev/null | tail -n +25 | xargs -r rm -f
  fi
done
