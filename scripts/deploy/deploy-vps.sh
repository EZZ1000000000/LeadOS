#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# LeadOS — نشر كامل على أي VPS Ubuntu بأمر واحد
# الاستخدام (على الـVPS نفسه بعد نقل المجلد):
#   bash scripts/deploy/deploy-vps.sh
# ═══════════════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")/../.." || exit 1
echo "📁 مجلد المشروع: $(pwd)"

# ─── 1) Docker لو مش موجود ───
if ! command -v docker >/dev/null 2>&1; then
  echo "📦 تنصيب Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
else
  echo "✅ Docker موجود"
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "📦 تنصيب docker compose plugin..."
  apt-get update -y && apt-get install -y docker-compose-plugin
fi

# ─── 2) متغيرات البيئة ───
if [ ! -f .env.local ]; then
  echo "❌ مفيش .env.local — انقل ملف المفاتيح (11 مفتاح dahl + CRON_SECRET + AUTH_SECRET) للمجلد الأول"
  exit 1
fi
echo "✅ .env.local موجود"

# AUTH_SECRET موجود؟ لو لأ — ولّد واحد قوي (لو الحاوية هتتلف وتتعاد، الجلسات تفضل صالحة)
if ! grep -q "^AUTH_SECRET=" .env.local; then
  SECRET=$(openssl rand -hex 32)
  echo "AUTH_SECRET=${SECRET}" >> .env.local
  echo "🔑 AUTH_SECRET اتولد تلقائياً"
fi

# ─── 3) جدار ناري بسيط ───
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp  >/dev/null 2>&1 || true   # SSH
  ufw allow 80/tcp  >/dev/null 2>&1 || true   # HTTP
  ufw allow 443/tcp >/dev/null 2>&1 || true   # HTTPS
  echo "✅ جدار ناري: 22/80/443 مفتوحة"
fi

# ─── 4) البناء والتشغيل ───
echo "🏗️  بناء الصورة (أول مرة بياخد 3-6 دقايق)..."
docker compose build

echo "🚀 تشغيل..."
docker compose up -d

# ─── 5) فحص بعد 30 ثانية ───
echo "⏳ استنى 30 ثانية وفحص..."
sleep 30
CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 10 http://localhost:3000/ 2>/dev/null || echo "000")
if [ "$CODE" = "200" ]; then
  echo ""
  echo "═══════════════════════════════════════════"
  echo "🎉 LeadOS شغال على السيرفر — http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR-SERVER-IP'):3000"
  echo "═══════════════════════════════════════════"
  echo "• القاعدة الدائمة: ./db/custom.db (بتنسخ احتياطياً كل 30 دقيقة في ./backups)"
  echo "• الحلقات: supervisor + نبضة كل 11 دقيقة + باك أب داخلي وخارجي"
  echo "• إعادة تشغيل تلقائية: docker restart policy + supervisor ذاتي الإصلاح"
  echo "• لو هتدومين: عدّل Caddyfile.deploy بحط الدومين ثم: docker compose restart caddy"
  echo "• متابعة اللوجات: docker compose logs -f leados"
else
  echo "⚠️ الخادم رجع $CODE — شوف اللوجات: docker compose logs --tail 50 leados"
fi
