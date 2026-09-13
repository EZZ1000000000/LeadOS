#!/bin/bash
# إعادة اختبار Webhook بالحقل الصحيح name + تنظيف ليد الاختبار
cd /home/z/my-project
OUT=tool-results/webhook-retest.txt
> "$OUT"

TOKEN=$(bun -e "
import { signToken } from './src/lib/auth'
import { db } from './src/lib/db'
const u = await db.user.findFirst({ where: { role: 'OWNER' }, select: { id: true } })
console.log(signToken({ sub: u.id }))
process.exit(0)" 2>/dev/null | tail -1)

setsid bash -c 'exec /home/z/my-project/node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1' < /dev/null > /dev/null 2>&1 &
for i in $(seq 1 30); do
  sleep 2
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ --max-time 10 2>/dev/null)
  [ "$code" = "200" ] && break
done
echo "SERVER: UP" >> "$OUT"

echo "── POST صحيح (name بدل title) ──" >> "$OUT"
curl -s -X POST "http://localhost:3000/api/ingest/webhook" \
  -H "Content-Type: application/json" \
  -H "x-api-key: INGEST_9a6214714acd0be22d8460d696355a75" \
  -d '{"source":"system-check","platform":"GOOGLE_MAPS","items":[{"name":"صيدلية اختبار النظام الشامل","url":"https://maps.google.com/?cid=999999991","phone":"01000000001","address":"المعادي، القاهرة"}]}' \
  --max-time 60 >> "$OUT" 2>&1
echo "" >> "$OUT"

echo "── منع التكرار (نفس العنصر مرة تانية) ──" >> "$OUT"
curl -s -X POST "http://localhost:3000/api/ingest/webhook" \
  -H "Content-Type: application/json" \
  -H "x-api-key: INGEST_9a6214714acd0be22d8460d696355a75" \
  -d '{"source":"system-check","platform":"GOOGLE_MAPS","items":[{"name":"صيدلية اختبار النظام الشامل","url":"https://maps.google.com/?cid=999999991","phone":"01000000001","address":"المعادي، القاهرة"}]}' \
  --max-time 60 >> "$OUT" 2>&1
echo "" >> "$OUT"

echo "── تنظيف ليد الاختبار ──" >> "$OUT"
bun -e "
import { db } from './src/lib/db'
const b = await db.business.findFirst({ where: { name: 'صيدلية اختبار النظام الشامل' } })
if (b) {
  const leads = await db.lead.findMany({ where: { businessId: b.id } })
  for (const l of leads) await db.lead.delete({ where: { id: l.id } })
  await db.business.delete({ where: { id: b.id } })
  console.log('deleted test business + ' + leads.length + ' leads')
} else console.log('test business not found (created 0 leads — classified out)')
const total = await db.lead.count()
console.log('total leads now:', total)
process.exit(0)" 2>&1 | grep -v prisma >> "$OUT"

cat "$OUT"
