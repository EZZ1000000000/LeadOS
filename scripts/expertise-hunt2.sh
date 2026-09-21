#!/bin/bash
# موجة بحث 2 — تغطية الخدمات الناقصة + إحصائيات إقناع أعمق
set -u
OUT="/home/z/my-project/research/expertise"
mkdir -p "$OUT"

search() {
  local id="$1"; local query="$2"; local num="${3:-8}"
  local f="$OUT/$id.json"
  if [ -s "$f" ]; then echo "↷ skip $id"; return; fi
  echo "🔎 $id: $query"
  z-ai function -n web_search -a "{\"query\": $(echo "$query" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'), \"num\": $num}" -o "$f" 2>/dev/null
  if [ ! -s "$f" ]; then sleep 2; z-ai function -n web_search -a "{\"query\": $(echo "$query" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'), \"num\": $num}" -o "$f" 2>/dev/null; fi
  [ -s "$f" ] && echo "   ✓ ok" || echo "   ✗ فشل"
  sleep 1
}

# خدمات ناقصة
search g1_email_selling "selling email marketing services ecommerce clients ROI statistics 2025" 8
search g2_influencer "influencer marketing ROI statistics businesses trust 2025" 8
search g3_uiux_selling "selling UI UX design services clients business value conversion" 8
search g4_maintenance "website maintenance retainer selling recurring revenue clients" 8
search g5_geo_selling "generative engine optimization GEO services selling AI search visibility businesses" 8
search g6_media_pricing "media buying agency pricing percentage of ad spend vs flat fee retainer" 8
search g7_missed_calls "small businesses missed calls lost revenue statistics answering AI" 8
search g8_landing "average landing page conversion rate statistics industry benchmark 2025" 8
search g9_online_presence "percentage consumers research business online before visiting statistics" 8
search g10_reviews "online reviews statistics trust consumers purchase decision 2025" 8
search g11_speed_lead "speed to lead statistics response time within 5 minutes conversion" 8
search g12_concessions "sales negotiation concession strategies if then trading discounts" 8
search g13_proposals "sales proposal structure win rate research statistics" 8
search g14_arabic_selling "فن البيع والاقناع للعملاء نصائح نفسية" 8
search g15_consultative "consultative selling technique small business owner pain questions" 8

echo ""
echo "═══ إجمالي ملفات البحث ═══"
ls "$OUT"/*.json 2>/dev/null | wc -l
