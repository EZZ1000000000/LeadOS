"""اختبار فعلي لكل المفاتيح: Mistral (25 مفتاح) + Serper + Tavily + SerpAPI + Exa."""
import json
import urllib.request
import urllib.error
from pathlib import Path

# تحميل .env
env = {}
for line in Path("/home/z/my-project/.env").read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()


def http_json(url, data=None, headers=None, timeout=20, method=None):
    req = urllib.request.Request(url, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
        body = json.dumps(data).encode()
    else:
        body = None
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, body, timeout=timeout) as r:
        return r.status, json.loads(r.read().decode())


print("=" * 58)
print("1) مفاتيح Mistral — اختبار دوراني على عينة")
mistral_keys = [k.strip() for k in env.get("MISTRAL_API_KEYS", "").split(",") if len(k.strip()) >= 20]
primary = env.get("MISTRAL_API_KEY", "").strip()
if primary and primary not in mistral_keys:
    mistral_keys.insert(0, primary)
print(f"   إجمالي المفاتيح: {len(mistral_keys)}")
good = 0
for i, key in enumerate(mistral_keys):
    try:
        st, data = http_json(
            "https://api.mistral.ai/v1/chat/completions",
            data={"model": "mistral-small-latest", "messages": [{"role": "user", "content": "قل: جاهز"}], "max_tokens": 10},
            headers={"Authorization": f"Bearer {key}"},
            timeout=25,
        )
        text = data.get("choices", [{}])[0].get("message", {}).get("content", "")[:20]
        good += 1
        print(f"   ✅ مفتاح {i+1}: رد='{text}'")
    except urllib.error.HTTPError as e:
        print(f"   ❌ مفتاح {i+1}: HTTP {e.code}")
    except Exception as e:
        print(f"   ⚠️ مفتاح {i+1}: {str(e)[:50]}")
print(f"   → المفاتيح الشغالة: {good}/{len(mistral_keys)}")

print()
print("=" * 58)
print("2) Serper — بحث جوجل")
try:
    st, data = http_json(
        "https://google.serper.dev/search",
        data={"q": "عيادات أسنان القاهرة", "num": 5, "gl": "eg", "hl": "ar"},
        headers={"X-API-KEY": env["SERPER_API_KEY"], "Content-Type": "application/json"},
    )
    organic = data.get("organic", [])
    print(f"   ✅ HTTP {st} — {len(organic)} نتيجة")
    for r in organic[:3]:
        print(f"      • {r.get('title','')[:60]}")
except Exception as e:
    print(f"   ❌ {str(e)[:80]}")

print()
print("3) Tavily")
try:
    st, data = http_json(
        "https://api.tavily.com/search",
        data={"query": "مطاعم مصر", "max_results": 5, "search_depth": "basic"},
        headers={"Authorization": f"Bearer {env['TAVILY_API_KEY']}"},
    )
    print(f"   ✅ HTTP {st} — {len(data.get('results', []))} نتيجة")
except Exception as e:
    print(f"   ❌ {str(e)[:80]}")

print()
print("4) SerpAPI")
try:
    st, data = http_json(
        f"https://serpapi.com/search.json?engine=google&q=كافيهات+القاهرة&num=5&gl=eg&hl=ar&api_key={env['SERPAPI_API_KEY']}",
        timeout=25,
    )
    print(f"   ✅ HTTP {st} — {len(data.get('organic_results', []))} نتيجة")
except Exception as e:
    print(f"   ❌ {str(e)[:80]}")

print()
print("5) Exa")
try:
    st, data = http_json(
        "https://api.exa.ai/search",
        data={"query": "egyptian restaurants cairo", "numResults": 5},
        headers={"x-api-key": env["EXA_API_KEY"]},
    )
    print(f"   ✅ HTTP {st} — {len(data.get('results', []))} نتيجة")
except Exception as e:
    print(f"   ❌ {str(e)[:80]}")
