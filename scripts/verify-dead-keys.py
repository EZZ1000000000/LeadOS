"""تحقق تفصيلي: ليه المفاتيح فاشلة؟ (حصة خلصت ولا مفتاح بايظ؟)"""
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

def req(url, data=None, headers=None, timeout=25):
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
            return e.code, e.read().decode()[:300]
        except Exception:
            return e.code, "(no body)"
    except Exception as e:
        return 0, str(e)[:150]

print("=== 1) Mistral — مفتاح 1: إيه رسالة الخطأ بالظبط؟ ===")
k1 = prod.get("MISTRAL_API_KEYS","").split(",")[0].strip() or prod.get("MISTRAL_API_KEY","")
st, body = req("https://api.mistral.ai/v1/chat/completions",
    data={"model": "mistral-small-latest", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 4},
    headers={"Authorization": f"Bearer {k1}"})
print(f"HTTP {st} | {body}")

print("\n=== 2) dahl — مفتاح 1: إيه رسالة الخطأ بالظبط؟ ===")
dahl_base = local.get("DAHL_BASE_URL", "https://inference.dahl.global/v1")
dk1 = local.get("DAHL_API_KEY", "")
st, body = req(f"{dahl_base}/chat/completions",
    data={"model": "deepseek-ai/DeepSeek-V3", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 4},
    headers={"Authorization": f"Bearer {dk1}"})
print(f"HTTP {st} | {body}")

print("\n=== 3) dahl — إيه الموديلات المتاحة أصلاً؟ ===")
st, body = req(f"{dahl_base}/models", headers={"Authorization": f"Bearer {dk1}"})
print(f"HTTP {st} | {body}")

print("\n=== 4) Gemini — مفتاح: ميت ولا الحصة؟ ===")
gk = prod.get("GEMINI_API_KEY","")
st, body = req(f"https://generativelanguage.googleapis.com/v1beta/models?key={gk}")
print(f"HTTP {st} | {body}")

print("\n=== 5) SerpAPI — الرصيد المتبقي بالظبط؟ ===")
st, body = req(f"https://serpapi.com/account?api_key={prod.get('SERPAPI_API_KEY','')}")
print(f"HTTP {st} | {body}")

print("\n=== 6) Exa — الرصيد المتبقي؟ ===")
st, body = req("https://api.exa.ai/search",
    data={"query": "test", "numResults": 1},
    headers={"x-api-key": prod.get("EXA_API_KEY","")})
print(f"HTTP {st} | {body[:150]}")
