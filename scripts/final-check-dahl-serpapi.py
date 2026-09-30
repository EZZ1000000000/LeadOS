"""اختبار أخير: dahl بالموديلات الحية + رصيد SerpAPI الكامل"""
import json, urllib.request, urllib.error, ssl
from pathlib import Path

ctx = ssl.create_default_context()

def load_env(path):
    env = {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"')
    return env

prod = load_env("/home/z/my-project/.env.vercel-prod")
local = load_env("/home/z/my-project/.env.local")

def req(url, data=None, headers=None, timeout=40):
    r = urllib.request.Request(url)
    body = None
    if data is not None:
        r.add_header("Content-Type", "application/json")
        body = json.dumps(data).encode()
    for k, v in (headers or {}).items():
        r.add_header(k, v)
    try:
        with urllib.request.urlopen(r, body, timeout=timeout, context=ctx) as resp:
            return resp.status, resp.read().decode()[:300]
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read().decode()[:200]
        except Exception:
            return e.code, "(no body)"
    except Exception as e:
        return 0, str(e)[:150]

print("=== dahl — GLM-5.3-Flash بكل الـ 11 مفتاح ===")
dahl_base = local.get("DAHL_BASE_URL", "https://inference.dahl.global/v1")
dahl_keys = [v for k, v in sorted(local.items()) if k.startswith("DAHL_API_KEY")]
good = 0
for i, key in enumerate(dahl_keys, 1):
    st, body = req(f"{dahl_base}/chat/completions",
        data={"model": "zai-org/GLM-5.3-Flash", "messages": [{"role": "user", "content": "قول جاهز"}], "max_tokens": 8},
        headers={"Authorization": f"Bearer {key}"})
    if st == 200:
        good += 1
    else:
        print(f"   مفتاح {i}: HTTP {st} | {body[:90]}")
print(f"   → شغالين {good}/{len(dahl_keys)} بموديل GLM-5.3-Flash")

print("\n=== SerpAPI — الرصيد كامل ===")
st, body = req(f"https://serpapi.com/account?api_key={prod.get('SERPAPI_API_KEY','')}", timeout=30)
try:
    acc = json.loads(body)
    print(f"   الحالة: {acc.get('account_status')} | الخطة: {acc.get('plan_name')}")
    print(f"   باقي: {acc.get('total_searches_left')} بحث | التجديد: {acc.get('plan_renewal_date')}")
except Exception as e:
    print(f"   HTTP {st} | parse fail: {e}")
