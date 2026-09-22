#!/usr/bin/env bash
# LeadOS — استعادة كارثة سريعة: يرجّع آخر باك أب خارجي حي (فيه ليدز)
# الاستخدام: bash scripts/restore-from-external.sh [ملف-اختياري.db]
SAFE_DIR="/home/z/leados-backups"
cd /home/z/my-project || exit 1

SRC="${1}"
if [ -z "$SRC" ]; then
  # آخر نسخة فيها ليدز > 0
  for f in $(ls -t "$SAFE_DIR"/custom-*.db "$SAFE_DIR"/custom-latest.db 2>/dev/null); do
    C=$(bun -e "const {Database}=require('bun:sqlite');try{console.log(new Database('$f',{readonly:true}).query('SELECT COUNT(*) c FROM Lead').get().c)}catch(e){console.log(0)}" 2>/dev/null)
    if [ "${C:-0}" -gt 0 ]; then SRC="$f"; break; fi
  done
fi

if [ -z "$SRC" ] || [ ! -f "$SRC" ]; then
  echo "❌ مفيش نسخة صالحة في $SAFE_DIR"; exit 1
fi

LEADS=$(bun -e "const {Database}=require('bun:sqlite');try{console.log(new Database('$SRC',{readonly:true}).query('SELECT COUNT(*) c FROM Lead').get().c)}catch(e){console.log(0)}" 2>/dev/null)
echo "⏳ استعادة من: $SRC ($LEADS ليد)"
# إيقاف الخادم مؤقتاً عشان القاعدة ما تتكتبش أثناء الاستبدال
pkill -9 -f "next-server" 2>/dev/null; pkill -9 -f "standalone/server.js" 2>/dev/null
sleep 1
cp "$SRC" db/custom.db
echo "✅ القاعدة رجعت — المشرف هيرجّع الخادم خلال ≤60 ثانية"
