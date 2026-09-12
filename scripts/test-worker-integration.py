"""اختبار تدفق Worker الكامل مع محاكاة مهام المتصفح (بدون Chrome) — يثبت سلامة التكامل."""
import sys
sys.path.insert(0, "/home/z/my-project/worker")

import bot  # noqa: E402  (يُهيئ GUARD + CLIENT)

# --- محاكاة مهام المتصفح: نفس شكل المخرجات الحقيقية ---
def fake_maps(data):
    print(f"[SIM maps] query={data['query']}")
    return [
        {"name": f"TEST-مطعم سيموليشن {i}", "url": f"https://maps.google.com/sim/{i}",
         "phone": f"0100000000{i}", "rating": 4.2, "reviewCount": 40 + i,
         "body": "فئة: مطعم", "externalId": f"sim-{i}"} for i in range(3)
    ]

def fake_serp(data):
    print(f"[SIM serp] query={data['query']} platform={data['platform']}")
    return [
        {"name": f"TEST-صفحة سيموليشن {data['platform']} {i}", "url": f"https://facebook.com/sim{data['platform']}{i}",
         "body": "صفحة أعمال", "handle": f"sim{i}", "externalId": f"sim-{data['platform']}-{i}"} for i in range(2)
    ]

bot.scrape_google_maps = fake_maps
bot.scrape_serp = fake_serp

# --- شغّل دورة كاملة عبر run_cycle (الحارس + الميزانيات + الإرسال الحقيقي لـ LeadOS) ---
bot.run_cycle()
print("\n✅ اختبار التكامل اكتمل — راجع المخرجات أعلاه")
