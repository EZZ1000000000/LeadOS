#!/usr/bin/env bash
# LeadOS — مراقب الاستقرار 8 ساعات
# عينة كل 30 دقيقة (16 عينة): الخادم، الليدز، الاكتشاف، AI، النبضة، الأخطاء، أرقام لوحة التحكم الحية
# بعد 8 ساعات يكتب "التقرير النهائي" في نفس اللوج
# التشغيل: (setsid bash scripts/run-8h-monitor.sh > /dev/null 2>&1 &)
cd /home/z/my-project || exit 1
LOG="logs/8h-monitor.log"
ERRMARK="logs/.8h-err-line"
COOKIE="/tmp/leados-cookies.txt"
HOURS="${1:-8}"

START=$(date +%s)
END=$((START + HOURS * 3600))
SAMPLES=$((HOURS * 2))   # كل 30 دقيقة

log() { echo "$1" >> "$LOG"; }

log "═══════════════════════════════════════════════"
log "═══ بدء مراقبة ${HOURS} ساعات: $(date '+%Y-%m-%d %H:%M:%S') ═══"
log "═══════════════════════════════════════════════"

# خط الأساس
BASE_LEADS=$(bun -e "const {Database}=require('bun:sqlite');const db=new Database('db/custom.db',{readonly:true});console.log(db.query('SELECT COUNT(*) c FROM Lead').get().c)" 2>/dev/null)
log "خط الأساس: ${BASE_LEADS} ليد عند البدء"
# علامة قراءة أخطاء الخادم (سطر البداية)
tail -n 1 logs/server.log > /dev/null 2>&1 && wc -l < logs/server.log > "$ERRMARK" 2>/dev/null || echo 0 > "$ERRMARK"

DOWN_COUNT=0
TICK_FAIL=0
AI_DAHl_OK=0; AI_DAHL_FAIL=0; AI_ZAI=0

for i in $(seq 1 "$SAMPLES"); do
  sleep 1800
  TS=$(date '+%d/%b %H:%M')

  # 1) الخادم
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 8 http://localhost:3000/ 2>/dev/null)
  MEM=$(ps aux | rg "next-server" | rg -v rg | head -1 | awk '{print $4}')
  [ "$CODE" != "200" ] && DOWN_COUNT=$((DOWN_COUNT+1))

  # 2) الليدز والاكتشاف (من القاعدة مباشرة)
  read -r LEADS LASTLEAD SUCC RUNN QUEUE FAILD <<< "$(bun -e "
const {Database}=require('bun:sqlite');
const db=new Database('db/custom.db',{readonly:true});
const c=db.query('SELECT COUNT(*) c FROM Lead').get().c;
const l=db.query('SELECT createdAt FROM Lead ORDER BY createdAt DESC LIMIT 1').get();
const jobs=db.query(\"SELECT status, COUNT(*) c FROM Job WHERE type='DISCOVERY' GROUP BY status\").all();
let s=0,r=0,q=0,f=0; for(const j of jobs){ if(j.status==='SUCCESS')s=j.c; if(j.status==='RUNNING')r=j.c; if(j.status==='QUEUED')q=j.c; if(j.status==='RETRYING')f=j.c; }
console.log(c, l?Math.floor(l.createdAt/1000):0, s, r, q, f);
" 2>/dev/null)"
  LASTLEAD_FMT=$([ "$LASTLEAD" != "0" ] && [ -n "$LASTLEAD" ] && date -d @"$LASTLEAD" '+%H:%M' 2>/dev/null || echo "؟")

  # 3) AI آخر ساعة (من AiRun)
  read -r DOK DFL ZOK <<< "$(bun -e "
const {Database}=require('bun:sqlite');
const db=new Database('db/custom.db',{readonly:true});
const h=Date.now()-3600*1000;
const rows=db.query('SELECT provider, success, COUNT(*) c FROM AiRun WHERE createdAt > ? GROUP BY provider, success',[h]).all();
let dok=0,dfl=0,zok=0;
for(const r of rows){ if(r.provider==='DAHL'){ if(r.success)dok+=r.c; else dfl+=r.c; } if(r.provider==='ZAI'&&r.success)zok+=r.c; }
console.log(dok, dfl, zok);
" 2>/dev/null)"
  AI_DAHl_OK=$((AI_DAHl_OK+DOK)); AI_DAHL_FAIL=$((AI_DAHL_FAIL+DFL)); AI_ZAI=$((AI_ZAI+ZOK))

  # 4) آخر tick
  TICKLINE=$(tail -n 1 db/backups/tick.log 2>/dev/null | head -c 60)
  echo "$TICKLINE" | rg -q " 200" || TICK_FAIL=$((TICK_FAIL+1))

  # 5) الحلقات
  SUP="✗"; TL="✗"; BL="✗"
  pgrep -f "prod-supervisor" >/dev/null && SUP="✅"
  pgrep -f "tick-loop" >/dev/null && TL="✅"
  pgrep -f "backup-loop" >/dev/null && BL="✅"

  # 6) أخطاء جديدة في server.log
  LASTLINE=$(cat "$ERRMARK" 2>/dev/null || echo 0)
  NOWLINE=$(wc -l < logs/server.log 2>/dev/null || echo 0)
  NEWERR=$(tail -n +"$((LASTLINE+1))" logs/server.log 2>/dev/null | rg -ci "error|ECONN|cannot find" || echo 0)
  echo "$NOWLINE" > "$ERRMARK"
  ERRMSG="لا شيء"
  [ "$NEWERR" -gt 0 ] && ERRMSG="${NEWERR} سطر (تفاصيل في server.log)"

  # 7) لوحة التحكم الحية (بيانات المساحة الحقيقية عبر الجلسة)
  OV=$(curl -s -m 10 -b "$COOKIE" http://localhost:3000/api/overview 2>/dev/null)
  PANEL=$(echo "$OV" | python3 -c "
import json, sys
try:
  d = json.load(sys.stdin)
  k = d.get('kpis', {})
  print(f\"اللوحة: total={k.get('totalLeads','؟')} active={k.get('activeSources','؟')} jobs={k.get('activeJobs','؟')}\")
except Exception:
  print('اللوحة: استجابة غير متوقعة')
" 2>/dev/null)

  log "── عينة ${i}/16 — ${TS} ──"
  log "خادم: ${CODE} | ذاكرة: ${MEM:-؟}% | ${PANEL}"
  log "ليدز: ${LEADS} (زاد ${LEADS}-${BASE_LEADS} عن البداية) | آخر ليد: ${LASTLEAD_FMT}"
  log "اكتشاف: ${SUCC} نجاح / ${RUNN} شغالة / ${QUEUE} طابور / ${FAILD} إعادة"
  log "AI آخر ساعة: DAHL ${DOK} نجاح / ${DFL} فشل | ZAI ${ZOK} | tick آخر: ${TICKLINE}"
  log "حلقات: مشرف ${SUP} نبضة ${TL} باك أب ${BL} | أخطاء جديدة: ${ERRMSG}"
  log ""
done

# ═══ التقرير النهائي ═══
FINAL_LEADS=$(bun -e "const {Database}=require('bun:sqlite');const db=new Database('db/custom.db',{readonly:true});console.log(db.query('SELECT COUNT(*) c FROM Lead').get().c)" 2>/dev/null)
FINAL_SUCC=$(bun -e "const {Database}=require('bun:sqlite');const db=new Database('db/custom.db',{readonly:true});console.log(db.query(\"SELECT COUNT(*) c FROM Job WHERE type='DISCOVERY' AND status='SUCCESS'\").get().c)" 2>/dev/null)
FINAL_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 8 http://localhost:3000/ 2>/dev/null)

log "═══════════════════════════════════════════════"
log "═══ التقرير النهائي بعد ${HOURS} ساعات — $(date '+%Y-%m-%d %H:%M:%S') ═══"
log "═══════════════════════════════════════════════"
log "الليدز: من ${BASE_LEADS} إلى ${FINAL_LEADS} (نتيجة صيد: $((FINAL_LEADS-BASE_LEADS)) ليد جديد)"
log "مهام اكتشاف ناجحة تراكمية: ${FINAL_SUCC}"
log "AI تراكمي: DAHL ${AI_DAHl_OK} نجاح / ${AI_DAHL_FAIL} فشل | ZAI ${AI_ZAI}"
log "استقرار الخادم: ${DOWN_COUNT} عينة انقطاع من ${SAMPLES} | الحالة النهائية: ${FINAL_CODE}"
log "دورات نبضة فاشلة: ${TICK_FAIL} من ${SAMPLES}"
log "النطاق: $(date -d @${START} '+%d/%b %H:%M') → $(date -d @${END} '+%d/%b %H:%M')"
log "═══ نهاية التقرير ═══"
