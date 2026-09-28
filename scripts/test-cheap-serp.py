"""اختبار بدائل SERP الرخيصة: DDG HTML + Bing — مباشرة وعبر ZenRows (1 كريدت)."""
import os
import urllib.request, urllib.parse, urllib.error, ssl, re

ctx = ssl.create_default_context()
K1 = os.environ.get("ZENROWS_API_KEYS", "").split(",")[0].strip()
Q = "site:linkedin.com/in cairo dentist"

def fetch(url, timeout=45, headers=None):
    r = urllib.request.Request(url, headers=headers or {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
    try:
        with urllib.request.urlopen(r, timeout=timeout, context=ctx) as resp:
            return resp.status, resp.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return 0, str(e)[:80]

q_enc = urllib.parse.quote(Q)

print("=== 1) DDG HTML مباشرة (0 كريدت) ===")
st, body = fetch(f"https://html.duckduckgo.com/html/?q={q_enc}")
links = len(re.findall(r'class="result__a" href="', body))
print(f"HTTP {st} | طول {len(body)} | نتايج result__a: {links}")

print("\n=== 2) DDG Lite مباشرة (0 كريدت) ===")
st, body = fetch(f"https://lite.duckduckgo.com/lite/?q={q_enc}")
links = len(re.findall(r"class='result-link'", body)) + len(re.findall(r'result-link', body))
print(f"HTTP {st} | طول {len(body)} | آثار نتايج: {links}")

print("\n=== 3) Bing مباشرة (0 كريدت) ===")
st, body = fetch(f"https://www.bing.com/search?q={q_enc}&count=20")
links = len(re.findall(r'<li class="b_algo"', body))
print(f"HTTP {st} | طول {len(body)} | نتايج b_algo: {links}")

print("\n=== 4) DDG HTML عبر ZenRows (1 كريدت) ===")
u = "https://api.zenrows.com/v1/?" + urllib.parse.urlencode({"apikey": K1, "url": f"https://html.duckduckgo.com/html/?q={q_enc}"})
st, body = fetch(u, timeout=60)
links = len(re.findall(r'class="result__a" href="', body))
print(f"HTTP {st} | طول {len(body)} | نتايج: {links}")

print("\n=== 5) Bing عبر ZenRows (1 كريدت) ===")
u = "https://api.zenrows.com/v1/?" + urllib.parse.urlencode({"apikey": K1, "url": f"https://www.bing.com/search?q={q_enc}&count=20"})
st, body = fetch(u, timeout=60)
links = len(re.findall(r'<li class="b_algo"', body))
print(f"HTTP {st} | طول {len(body)} | نتايج: {links}")
