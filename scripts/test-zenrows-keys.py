"""اختبار مفاتيح ZenRows الثلاثة — شغالين؟ وإيه اللي بيستهلو من الكريدت؟"""
import urllib.request, urllib.parse, urllib.error, ssl, json, re

ctx = ssl.create_default_context()
KEYS = [
    "***REMOVED***",
    "***REMOVED***",
    "***REMOVED***",
]

def zenrows(key, target, params=None, timeout=40):
    qs = {"apikey": key, "url": target}
    qs.update(params or {})
    url = "https://api.zenrows.com/v1/?" + urllib.parse.urlencode(qs)
    r = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(r, timeout=timeout, context=ctx) as resp:
            return resp.status, dict(resp.headers), resp.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        try:
            return e.code, dict(e.headers), e.read().decode("utf-8", "ignore")[:300]
        except Exception:
            return e.code, dict(e.headers), ""
    except Exception as e:
        return 0, {}, str(e)[:150]

print("=== اختبار 1: صفحة بسيطة (مثال.com) — المفتاح صحيح؟ ===")
for i, k in enumerate(KEYS, 1):
    st, h, body = zenrows(k, "https://example.com")
    print(f"مفتاح {i}: HTTP {st} | طول الرد {len(body)} | هيدر كريدت: " + str({kk: v for kk, v in h.items() if 'credit' in kk.lower() or 'ratelimit' in kk.lower() or 'x-' in kk.lower()[:3]})[:200])

print("\n=== اختبار 2: بحث جوجل عبر ZenRows (بديل Serper) ===")
google = "https://www.google.com/search?q=site:linkedin.com/in+%D8%B9%D9%8A%D8%A7%D8%AF%D8%A9+%D8%A3%D8%B3%D9%86%D8%A7%D9%86+%D8%A7%D9%84%D9%82%D8%A7%D9%87%D8%B1%D8%A9&num=20&hl=ar&gl=eg"
for i, k in enumerate(KEYS, 1):
    st, h, body = zenrows(k, google)
    h3s = len(re.findall(r"<h3", body))
    links = len(re.findall(r'href="https?://(?!www\.google|maps\.google|accounts|support|policies)[^"]+"', body))
    print(f"مفتاح {i}: HTTP {st} | طول {len(body)} | عناوين h3: {h3s} | لينكات خارجية: {links}")
    if i == 1 and body:
        open("/home/z/my-project/scripts/zenrows-google-sample.html", "w").write(body)
        print("   (حفظت عينة HTML في scripts/zenrows-google-sample.html للتحليل)")
