"""
LeadOS Worker — bot.py (مفتوح المصدر، مبني على Botasaurus)
==========================================================
ووركر استكشاف عملاء حقيقي يشتغل 24/7 على أي استضافة تدعم Docker أو Python:
  - Google Maps: أسماء + تليفونات + مواقع + تقييمات (بدون أي API key)
  - فيسبوك/انستجرام/لينكدإن: نتايج بحث عامة + فتح صفحات فيسبوك مستخدمًا كوكيز جلسة محفوظة
  - كل النتايج تتغذى تلقائيًا في LeadOS عبر /api/ingest/webhook

الاستخدام:
  python bot.py status              # عرض الميزانيات وقواطع الدائرة
  python bot.py run                 # دورة واحدة (مناسب لـ GitHub Actions / cron)
  python bot.py loop                # تشغيل دائم بجدولة داخلية (مناسب لـ VPS / Railway)
  python bot.py health              # فحص الاتصال بـ LeadOS فقط
  python bot.py login facebook      # فتح متصفح مرئي لتسجيل دخول يدوي → الكوكيز تتحفظ في البروفايل
ملاحظة الكوكيز:
  Botasaurus بيحفظ بروفايل متصفح لكل منصة تلقائيًا في مجلد profiles/ — سجل دخول مرة واحدة
  والجلسة تعيش معاك. تقدر كمان تحط كوكيز جاهزة في state/facebook_cookies.json.
"""
from __future__ import annotations

import json
import random
import re
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import quote_plus

from botasaurus.browser import browser, Driver

from guard import Guard, load_config, pick_queries
from leados_client import LeadOSClient

CFG = load_config()
GUARD = Guard(CFG)
CLIENT = LeadOSClient(
    base_url=CFG["leados"]["base_url"],
    api_key=CFG["leados"].get("api_key", ""),
    timeout=int(CFG["leados"].get("timeout_seconds", 30)),
    batch_size=int(CFG["leados"].get("batch_size", 40)),
)

STATE_DIR = Path(__file__).parent / "state"
STATE_DIR.mkdir(exist_ok=True)

PROXY = CFG.get("proxy") or None


def _human(kind: str) -> None:
    GUARD.pause(kind)


def _load_cookie_file(platform: str) -> Optional[List[dict]]:
    """كوكيز اختيارية من state/<platform>_cookies.json (قائمة كوكيز قياسية)."""
    f = STATE_DIR / f"{platform.lower()}_cookies.json"
    if not f.exists():
        return None
    try:
        data = json.loads(f.read_text(encoding="utf-8"))
        return data if isinstance(data, list) and data else None
    except Exception:
        return None


# ============================================================================
# Google Maps — أفضل مصدر تليفونات حقيقي بدون API key
# ============================================================================
_EXTRACT_FEED = """
const cards = [...document.querySelectorAll('a.hfpxzc')];
return cards.slice(0, 40).map((a, i) => ({
  i,
  name: a.getAttribute('aria-label') || '',
  url: a.href || ''
})).filter(c => c.name);
"""

_EXTRACT_PANEL = """
(() => {
  const g = (sel) => { const el = document.querySelector(sel); return el ? (el.innerText || '').trim() : null; };
  return {
    phone: g('button[data-item-id="phone"]'),
    website: (() => { const a = document.querySelector('a[data-item-id="authority"]'); return a ? a.href : null; })(),
    address: g('button[data-item-id="address"]'),
    rating: (() => { const d = document.querySelector('div.F7nice'); return d ? (d.innerText || '').split('\\n')[0] : null; })(),
    reviews: (() => { const s = document.querySelector('div.F7nice span span[aria-label]'); return s ? s.getAttribute('aria-label') : null; })(),
    category: g('button.DkEaL'),
    title: g('div.DUwDvf')
  };
})()
"""


@browser(profile="google_maps", headless=True, block_images=True, close_on_crash=True, max_retry=1, retry_wait=20, output=None)
def scrape_google_maps(driver: Driver, data: Dict) -> List[Dict]:
    """data = { query, limit } → قائمة أعمال (اسم/تليفون/موقع/تقييم/عنوان)."""
    query = data["query"]
    limit = int(data.get("limit", 12))
    items: List[Dict] = []
    try:
        driver.set_locale_and_timezone(locale="ar-EG", timezone_id="Africa/Cairo")
        driver.google_get(f"https://www.google.com/maps/search/{quote_plus(query)}?hl=ar", accept_google_cookies=True)
        _human("page_load")

        if GUARD.cfg.get("safety", {}).get("stop_on_bot_detection", True) and driver.is_bot_detected():
            GUARD.trip("GOOGLE_MAPS", "bot detection في صفحة النتايج")
            return []

        # سكرول تدفقات النتايج عشان نجيب أكتر من الشاشة الأولى
        max_scrolls = 6
        for _ in range(max_scrolls):
            driver.run_js("const f = document.querySelector('div[role=\"feed\"]'); if (f) { f.scrollBy(0, 1400); }")
            _human("scroll")

        cards = driver.run_js(_EXTRACT_FEED) or []
        cards = cards[:limit]
        print(f"[maps] 📌 '{query}' → {len(cards)} مكان")

        for idx, card in enumerate(cards):
            # فتح لوحة التفاصيل لكل مكان (تليفون/موقع) — بنضغط على الكارت نفسه
            driver.run_js(f"const cs = document.querySelectorAll('a.hfpxzc'); if (cs[{idx}]) cs[{idx}].click();")
            driver.short_random_sleep()
            panel = driver.run_js(_EXTRACT_PANEL) or {}
            name = (panel.get("title") or card["name"] or "").strip()
            if not name:
                continue
            rating = None
            try:
                rating = float(str(panel.get("rating")).replace(",", ".")) if panel.get("rating") else None
            except (TypeError, ValueError):
                rating = None
            rev = re.sub(r"[^\d]", "", str(panel.get("reviews") or "")) or None
            items.append({
                "name": name[:120],
                "url": card.get("url") or "",
                "phone": panel.get("phone"),
                "website": panel.get("website"),
                "address": panel.get("address"),
                "rating": rating,
                "reviewCount": int(rev) if rev else None,
                "body": f"فئة: {panel.get('category') or 'غير محددة'}",
                "externalId": (card.get("url") or name)[:150],
            })
            GUARD.human(random.uniform(2, 5))  # نبقى بشريين بين كل مكان والتاني
    except Exception as e:
        print(f"[maps] ❌ خطأ: {str(e)[:140]}")
        if "timeout" in str(e).lower() or "captcha" in str(e).lower():
            GUARD.trip("GOOGLE_MAPS", f"خطأ جسيم: {str(e)[:80]}")
    return items


# ============================================================================
# SERP عام — بحث جوجل مع site: لأي منصة (فيسبوك/انستجرام/لينكدإن/أدلة)
# ============================================================================
_EXTRACT_SERP = """
const results = [];
document.querySelectorAll('#search a h3, #rso a h3').forEach((h) => {
  const a = h.closest('a');
  if (!a || !a.href || a.href.includes('google.com')) return;
  const container = h.closest('div.g') || h.closest('div[data-hveid]') || h.parentElement;
  results.push({
    title: (h.innerText || '').trim(),
    url: a.href,
    snippet: container ? (container.innerText || '').slice(0, 300) : ''
  });
});
const seen = new Set();
return results.filter(r => { if (!r.title || seen.has(r.url)) return false; seen.add(r.url); return true; }).slice(0, 15);
"""


@browser(profile="serp", headless=True, block_images=True, close_on_crash=True, max_retry=1, retry_wait=20, output=None)
def scrape_serp(driver: Driver, data: Dict) -> List[Dict]:
    """data = { query, platform, limit } → نتايج بحث حقيقية (بادج/قناة/شركة/مقال)."""
    query = data["query"]
    platform = data.get("platform", "OTHER")
    limit = int(data.get("limit", 10))
    items: List[Dict] = []
    try:
        driver.set_locale_and_timezone(locale="ar-EG", timezone_id="Africa/Cairo")
        driver.google_get(f"https://www.google.com/search?q={quote_plus(query)}&hl=ar&num=20", accept_google_cookies=True)
        _human("page_load")

        if GUARD.cfg.get("safety", {}).get("stop_on_bot_detection", True) and driver.is_bot_detected():
            GUARD.trip(platform, "bot detection في صفحة بحث جوجل")
            return []

        results = driver.run_js(_EXTRACT_SERP) or []
        results = results[:limit]
        print(f"[serp] 📌 '{query}' → {len(results)} نتيجة")

        for r in results:
            handle = None
            m = re.search(r"(?:facebook\.com|instagram\.com|linkedin\.com)/([^/?#]+)", r.get("url", ""))
            if m and m.group(1) not in ("pages", "groups", "search"):
                handle = m.group(1)[:60]
            items.append({
                "name": r["title"][:120],
                "url": r["url"],
                "body": (r.get("snippet") or "")[:280],
                "handle": handle,
                "externalId": r["url"][:150],
            })

        # بالكوكيز: زيارة أول صفحتين من نطاق المنصة نفسها لاستخراج تليفون/إيميل (اختياري)
        cookie_platform = COOKIE_PLATFORMS.get(platform)
        cookies = _load_cookie_file(cookie_platform) if cookie_platform else None
        if cookies:
            domains = URL_DOMAINS.get(platform, [cookie_platform])
            platform_results = [r for r in results if any(d in r.get("url", "") for d in domains)][:2]
            for r in platform_results:
                extra = _scrape_page_with_cookies(driver, r["url"], cookies)
                if extra:
                    r.update(extra)
                GUARD.human(random.uniform(4, 9))
    except Exception as e:
        print(f"[serp] ❌ خطأ: {str(e)[:140]}")
    return items


_PHONE_RE = re.compile(r"(\+?20[-\s]?)?(01[0125][-\s]?\d{7,8}|0[2-3][-\s]?\d{7,8})", re.UNICODE)
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")


def _scrape_page_with_cookies(driver: Driver, url: str, cookies: List[dict]) -> Optional[Dict]:
    """فتح صفحة بكوكيز جلسة محفوظة واستخراج بيانات التواصل (بحذر شديد)."""
    try:
        driver.add_cookies(cookies)
        driver.get(url, timeout=45)
        driver.short_random_sleep()
        html = driver.page_html or ""
        text = re.sub(r"<[^>]+>", " ", html)
        phone = _PHONE_RE.search(text)
        email = _EMAIL_RE.search(text)
        out: Dict = {}
        if phone:
            out["phone"] = phone.group(0).strip()[:20]
        if email:
            out["extra_email"] = email.group(0)[:80]
        if out:
            print(f"[cookies] 📞 استخراج تواصل من {url[:70]}")
        return out or None
    except Exception as e:
        print(f"[cookies] ⚠️ فشل فتح الصفحة: {str(e)[:100]}")
        return None


# المنصات اللي فاتحين عليها جلسات (كوكيز في state/<platform>_cookies.json)
COOKIE_PLATFORMS = {"FACEBOOK": "facebook", "INSTAGRAM": "instagram", "X": "x", "LINKEDIN": "linkedin", "REDDIT": "reddit"}
# نطاق نتايج كل منصة اللي بنزورها بالكوكيز
URL_DOMAINS = {
    "FACEBOOK": ["facebook.com"],
    "INSTAGRAM": ["instagram.com"],
    "X": ["x.com", "twitter.com"],
    "LINKEDIN": ["linkedin.com"],
    "REDDIT": ["reddit.com"],
}


# ============================================================================
# مهمة دخول تفاعلية: احفظ كوكيز فيسبوك في البروفايل
# ============================================================================
@browser(profile="facebook", headless=False, close_on_crash=True, output=None)
def facebook_login_task(driver: Driver, data: Dict) -> str:
    driver.get("https://www.facebook.com/login")
    print("\n" + "=" * 60)
    print("سجّل دخولك في نافذة المتصفح اللي فتحت.")
    print("أول ما توصل للفيد → ارجع للترمينال واضغط Enter.")
    print("الكوكيز هتتحفظ تلقائيًا في بروفايل 'facebook' وتعيش بين الدورات.")
    print("=" * 60 + "\n")
    input("اضغط Enter بعد تسجيل الدخول... ")
    cookies = driver.get_cookies()
    (STATE_DIR / "facebook_cookies.json").write_text(json.dumps(cookies, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[facebook] ✅ حُفظ {len(cookies)} كوكيز في state/facebook_cookies.json")
    return "ok"


# ============================================================================
# التشغيل
# ============================================================================
def run_platform(platform: str, queries: List[str]) -> List[Dict]:
    """شغّل منصة واحدة على استعلاماتها مع احترام الميزانية والفواصل."""
    all_items: List[Dict] = []
    cap = int(CFG.get("worker", {}).get("max_items_per_platform_per_cycle", 25))

    for q in queries:
        remaining = GUARD.take(platform, n=1)
        if remaining < 1 or GUARD.blocked(platform):
            print(f"[guard] ميزانية {platform} خلصت أو مقفولة — توقف")
            break
        data = {"query": q, "platform": platform, "limit": min(cap - len(all_items), 12)}
        if platform == "GOOGLE_MAPS":
            items = scrape_google_maps(data)
        else:
            items = scrape_serp(data)
        all_items.extend(items)
        GUARD.note_results(platform, len(items))
        if len(all_items) >= cap:
            break
        _human("between_queries")

    GUARD.note_results(platform, len(all_items))
    if not all_items and GUARD.note_empty_cycle(platform):
        GUARD.trip(platform, "دورات فارغة متتالية — راحة احترازية")
    return all_items[:cap]


def run_cycle() -> None:
    print("\n🚀 LeadOS Worker — بدء دورة جديدة")
    if not CLIENT.healthcheck():
        print("⏭️  لا يمكن الوصول لـ LeadOS — الدورة اتلغت (جرب تاني بعد شوية)")
        return

    platforms = [p for p in CFG.get("queries", {}).keys() if not GUARD.blocked(p)]
    if not platforms:
        print("😴 كل المنصات مقفولة النهاردة — الدورة خلصت بسلام")
        return

    total = {"created": 0, "duplicates": 0}
    for platform in platforms:
        if GUARD.blocked(platform):
            continue
        if GUARD.remaining(platform) < 1:
            continue
        queries = pick_queries(CFG, platform, min(2, GUARD.remaining(platform)), GUARD)
        if not queries:
            continue
        print(f"\n📂 {platform} → {len(queries)} استعلام")
        items = run_platform(platform, queries)
        if items:
            res = CLIENT.send(platform, items)
            if res:
                total["created"] += res["created"]
                total["duplicates"] += res["duplicates"]
        _human("between_queries")

    print(f"\n✅ الدورة خلصت — Leads جديدة: {total['created']} | مكررة متجاهلة: {total['duplicates']}")


def loop_mode() -> None:
    base = int(CFG.get("worker", {}).get("loop_interval_minutes", 180))
    print(f"♾️  وضع دائم: دورة كل {base} دقيقة (مع عشوائية ±15%) — Ctrl+C للإيقاف")
    while True:
        try:
            run_cycle()
        except KeyboardInterrupt:
            print("\n👋 إيقاف")
            break
        except Exception as e:
            print(f"⚠️ خطأ غير متوقع: {str(e)[:160]}")
        jitter = random.uniform(0.85, 1.15)
        wait_s = int(base * 60 * jitter)
        print(f"💤 نوم {wait_s // 60} دقيقة...")
        try:
            time.sleep(wait_s)
        except KeyboardInterrupt:
            print("\n👋 إيقاف")
            break


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "run"
    if cmd == "status":
        print(GUARD.status())
    elif cmd == "health":
        CLIENT.healthcheck()
    elif cmd == "run":
        run_cycle()
    elif cmd == "loop":
        loop_mode()
    elif cmd == "login":
        platform = sys.argv[2] if len(sys.argv) > 2 else "facebook"
        if platform.lower() == "facebook":
            facebook_login_task({})
        else:
            print(f"تسجيل دخول {platform} مش مضبوط لسه — استخدم ملف state/{platform}_cookies.json يدويًا")
    elif cmd == "cookies":
        # عرض حالة الكوكيز المحفوظة لكل المنصات
        import json as _json
        for plat in ["facebook", "instagram", "x", "linkedin", "reddit"]:
            f = STATE_DIR / f"{plat}_cookies.json"
            if f.exists():
                try:
                    n = len(_json.loads(f.read_text(encoding="utf-8")))
                    print(f"  ✅ {plat}: {n} كوكيز")
                except Exception:
                    print(f"  ⚠️ {plat}: ملف تالف")
            else:
                print(f"  ❌ {plat}: لا يوجد")
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
