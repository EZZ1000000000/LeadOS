#!/usr/bin/env bash
# LeadOS — التحقق من تكامل Gemini: سيرفر + فحص حالة المزودين + شات حي + تتبع سلسلة التراجل
set -u
cd /home/z/my-project
OUT=tool-results/gemini-verify.txt
mkdir -p tool-results
: > "$OUT"

OWNER_KEY=$(grep -E '^OWNER_API_KEY=' .env | cut -d= -f2-)
PORT=3000

log() { echo "$1" | tee -a "$OUT"; }

# إصدار جلسة JWT صالحة (نفس آلية auth.ts — كوكي leados_session)
USER_ID=$(bun -e "
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const u = await db.user.findFirst({ select: { id: true } });
console.log(u?.id ?? '');
await db.\$disconnect();
" 2>/dev/null)
SESSION=$(bun -e "
import { signToken } from './src/lib/auth.ts';
console.log(signToken({ sub: '$USER_ID' }));
" 2>/dev/null)
AUTH="Cookie: leados_session=$SESSION"
log "[0] session issued for user ${USER_ID:0:8}... (len ${#SESSION})"


log() { echo "$1" | tee -a "$OUT"; }

# 1) شغّل السيرفر (يلتقط البيئة الجديدة بما فيها GEMINI_API_KEY)
setsid bun run dev >dev.log 2>&1 &
SERVER_PID=$!
log "[1] server starting (pid $SERVER_PID)..."

# 2) استنى الجاهزية (حد أقصى 60 ثانية)
READY=0
for i in $(seq 1 60); do
  if curl -s -m 2 "http://localhost:$PORT/api/health" >/dev/null 2>&1; then READY=1; break; fi
  sleep 1
done
if [ "$READY" = "1" ]; then log "[2] server READY"; else log "[2] server FAILED to start"; tail -20 dev.log | tee -a "$OUT"; exit 1; fi

# 3) حالة مزودي AI — لازم يظهر gemini:true
log "[3] AI provider status:"
curl -s -m 10 "http://localhost:$PORT/api/settings/ai" -H "$AUTH" \
  | tee -a "$OUT" | head -c 400; echo

# 4) شات حي — من هونج كونج: Gemini هيرفض 400 جغرافي → تبريد → تراجل لـz-ai (لازم يرد برد فعلي)
log "[4] live chat test (expect graceful GEMINI→z-ai fallback):"
CHAT=$(curl -s -m 60 "http://localhost:$PORT/api/chat" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"message":"رد بكلمة واحدة: تمام"}')
echo "$CHAT" | tee -a "$OUT" | head -c 500; echo

# 5) طلبين متتاليين إضافيين — إثبات إن التبريد بيمنع تكرار المحاولة المحكوم عليها
log "[5] second burst (cooldown active → instant z-ai):"
curl -s -m 60 "http://localhost:$PORT/api/chat" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"message":"قول: تمام2"}' | tee -a "$OUT" | head -c 300; echo

# 6) سجل AiRun — شوف آخر مزود اشتغل فعليًا
log "[6] recent AiRun providers in DB:"
bun -e "
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const runs = await db.aiRun.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { provider: true, model: true, success: true, latencyMs: true } });
console.log(JSON.stringify(runs));
await db.\$disconnect();
" 2>/dev/null | tee -a "$OUT"

# 7) أخطاء وقت التشغيل في dev.log بعد الإقلاع؟
log "[7] runtime errors in dev.log:"
grep -cE "Unhandled|ECONNREFUSED|TypeError" dev.log || true | tee -a "$OUT"

kill $SERVER_PID 2>/dev/null
log "[8] done — server stopped"
