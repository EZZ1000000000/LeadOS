#!/usr/bin/env bash
# LeadOS Worker — تشغيل سريع على VPS (من غير Docker)
# الاستخدام: bash run.sh loop | bash run.sh run | bash run.sh status
set -e
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "⚠️  لا يوجد .env — انسخ المثال: cp .env.example .env وعبّي القيم"
  exit 1
fi
set -a; source .env; set +a

python3 -m pip install --quiet -r requirements.txt
exec python3 bot.py "${1:-loop}"
