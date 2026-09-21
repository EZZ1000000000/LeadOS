#!/bin/bash
# حملة بحث ويب ضخمة — خبرات بيع حقيقية لكل مجالات الوكالة + السوق المصري
# النتايج تتخزن في research/expertise/*.json
set -u
OUT="/home/z/my-project/research/expertise"
mkdir -p "$OUT"

search() {
  local id="$1"; local query="$2"; local num="${3:-8}"
  local f="$OUT/$id.json"
  if [ -s "$f" ]; then echo "↷ skip $id"; return; fi
  echo "🔎 $id: $query"
  z-ai function -n web_search -a "{\"query\": $(echo "$query" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'), \"num\": $num}" -o "$f" 2>/dev/null
  if [ ! -s "$f" ]; then echo "   ⚠ فشل — إعادة محاولة"; sleep 2; z-ai function -n web_search -a "{\"query\": $(echo "$query" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'), \"num\": $num}" -o "$f" 2>/dev/null; fi
  [ -s "$f" ] && echo "   ✓ $(python3 -c "import json;d=json.load(open('$f'));print(len(d),'نتيجة')" 2>/dev/null || echo 'ok')" || echo "   ✗ فشل نهائي"
  sleep 1
}

# ─── الموجة 1: علم البيع الكوني الموثق ───
search c1_closing "most effective sales closing techniques backed by research 2025" 8
search c2_challenger "Challenger sale methodology key findings research results" 8
search c3_spin "SPIN selling questions framework statistics effectiveness" 8
search c4_followup "sales follow up statistics percentage deals require multiple follow ups" 8
search c5_negotiation "Never Split the Difference Chris Voss key techniques tactical empathy" 8
search c6_discovery "best discovery call questions framework sales SaaS services" 8
search c7_objections "sales objection handling framework laaer feel felt found research" 8
search c8_qualification "MEDDIC MEDDPICC BANT sales qualification framework comparison" 8
search c9_cialdini "Cialdini principles persuasion sales reciprocity scarcity social proof research" 8
search c10_pricing_psych "psychological pricing services anchoring decoy effect research" 8

# ─── الموجة 2: بيع الخدمات الرقمية (مجالات الوكالة) ───
search f1_webdesign "how to sell website design services to small business owners overcome objections" 8
search f2_seo_selling "selling SEO services to local businesses objections results timeline" 8
search f3_media_buying "how to sell Facebook ads management services to local businesses pitch" 8
search f4_software "selling custom software development services to SMB clients close deals" 8
search f5_social "how agencies sell social media management retainers close clients" 8
search f6_ai_agents "selling AI chatbot and automation services to small businesses 2025" 8
search f7_mobile "selling mobile app development projects clients pricing objections" 8
search f8_video "selling video production content services to businesses" 8
search f9_branding "selling branding identity design services positioning value" 8
search f10_agency_sales "digital agency sales process close high ticket retainers 2025" 8

# ─── الموجة 3: السوق المصري بالأرقام ───
search e1_web_prices "اسعار تصميم مواقع الكترونية في مصر 2025" 8
search e2_social_prices "اسعار ادارة صفحات السوشيال ميديا في مصر 2025" 8
search e3_ads_costs "متوسط تكلفة اعلانات فيسبوك انستجرام في مصر 2025" 8
search e4_app_prices "تكلفة عمل تطبيق موبايل في مصر اسعار" 8
search e5_seo_prices "اسعار خدمات السيو SEO في مصر" 8
search e6_egypt_buyers "سلوك المستهلك المصري الشراء اونلاين 2025 احصائيات" 8
search e7_whatsapp_usage "واتساب في مصر عدد المستخدمين تسويق 2025" 8

# ─── الموجة 4: التواصل البارد والواتساب والمتابعة ───
search w1_cold_whatsapp "cold WhatsApp sales message best practices response rate" 8
search w2_cold_dm "cold DM outreach small business owners what works conversion" 8
search w3_followup_templates "follow up message after no response sales templates research timing" 8
search w4_comments "comment marketing lead generation facebook groups value first" 8

# ─── الموجة 5: تكتيكات إغلاق متقدمة ───
search a1_trial_close "trial closing questions sales technique examples" 8
search a2_urgency "ethical urgency scarcity sales closing without lying" 8
search a3_value_selling "value based selling vs price selling services research margin" 8
search a4_retainer "how to sell monthly retainer agreements services clients" 8

echo ""
echo "═══ النتيجة ═══"
ls -la "$OUT" | tail -n +2 | wc -l
