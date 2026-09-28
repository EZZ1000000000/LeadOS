"""فحص لايف لكل مفاتيح API في LeadOS — مين خلص حصته ومين لسه شغال.
يقرأ المفاتيح الحقيقية من .env.vercel-prod (الإنتاج) + .env.local (dahl) + scripts/deploy/.tokens (NVIDIA).
"""
import json
import urllib.request
import urllib.error
import ssl
from pathlib import Path

ctx = ssl.create_default_context()

# ---------- تحميل المفاتيح ----------
def load_env(path):
    env = {}
    p = Path(path)
    if not p.exists():
        return env
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            v = v.strip().strip('"')
            env[k.strip()] = v
    return env

prod = load_env("/home/z/my-project/.env.vercel-prod")
local = load_env("/home/z/my-project/.env.local")
tokens = load_env("/home/z/my-project/scripts/deploy/.tokens")

results = []  # (name, ok, note, tier)

def req(url, data=None, headers=None, timeout=25, method=None):
    r = urllib.request.Request(url, method=method)
    body = None
    if data is not None:
        r.add_header("Content-Type", "application/json")
        body = json.dumps(data).encode()
    for k, v in (headers or {}).items():
        r.add_header(k, v)
    try:
        with urllib.request.urlopen(r, body, timeout=timeout, context=ctx) as resp:
            return resp.status, resp.read().decode()[:400]
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read().decode()[:400]
        except Exception:
            return e.code, ""
    except Exception as e:
        return 0, str(e)[:120]

# ---------- 1) Serper — محرك البحث الأساسي ----------
st, body = req("https://google.serper.dev/search",
    data={"q": "dentists cairo", "num": 1},
    headers={"X-API-KEY": prod.get("SERPER_API_KEY", ""), "Content-Type": "application/json"})
note = {200: "شغال", 403: "الحصة خلصت خلاص — محتاج مفتاح جديد", 402: "الكريدت خلص — محتاج مفتاح جديد", 401: "المفتاح بايظ/ملغى"}.get(st, f"HTTP {st}")
results.append(("Serper (بحث جوجل — العضمة بتاعت السكراب)", st == 200, f"{note} | {body[:80]}", "2500 كريدت مرة واحدة — بتخلص مرة واحدة مش كل شهر"))

# ---------- 2) Tavily ----------
st, body = req("https://api.tavily.com/search",
    data={"query": "cairo restaurants", "max_results": 1},
    headers={"Authorization": f"Bearer {prod.get('TAVILY_API_KEY','')}"})
note = {200: "شغال", 432: "حصة الشهر خلصت — تستنى الشهر الجديد أو مفتاح جديد", 429: "تجاوزت المعدل مؤقتًا", 401: "مفتاح بايظ"}.get(st, f"HTTP {st}")
results.append(("Tavily (بحث عميق)", st == 200, f"{note} | {body[:80]}", "1000 كريدت/شهر — بيتجدد كل شهر"))

# ---------- 3) SerpAPI — بيدي رصيد دقيق ----------
st, body = req(f"https://serpapi.com/account?api_key={prod.get('SERPAPI_API_KEY','')}")
left = "?"
try:
    acc = json.loads(body)
    left = f"باقي {acc.get('total_searches_left','?')} بحث من 100"
except Exception:
    pass
note = {200: f"شغال — {left}", 401: "مفتاح بايظ"}.get(st, f"HTTP {st} | {body[:80]}")
results.append(("SerpAPI (بحث جوجل بديل)", st == 200, note, "100 بحث/شهر — بيتجدد"))

# ---------- 4) Exa ----------
st, body = req("https://api.exa.ai/search",
    data={"query": "egypt cafes", "numResults": 1},
    headers={"x-api-key": prod.get("EXA_API_KEY","")})
note = {200: "شغال", 402: "الكريدت ($10) خلص خلاص — محتاج مفتاح جديد", 403: "ممنوع/حصة خلصت", 401: "مفتاح بايظ"}.get(st, f"HTTP {st}")
results.append(("Exa (بحث AI)", st == 200, f"{note} | {body[:80]}", "$10 كريدت مرة واحدة"))

# ---------- 5) Gemini ----------
st, body = req("https://generativelanguage.googleapis.com/v1beta/models",
    headers={"x-goog-api-key": prod.get("GEMINI_API_KEY","")})
note = {200: "شغال", 400: "مفتاح بايظ/مش مفعّل", 403: "مرفوض"}.get(st, f"HTTP {st}")
results.append(("Gemini (Google AI Studio)", st == 200, f"{note}", "مجاني بحصة يومية — بتيجي تاني كل يوم"))

# ---------- 6) Mistral — كل المفاتيح ----------
mistral_keys = [k.strip() for k in prod.get("MISTRAL_API_KEYS","").split(",") if len(k.strip()) >= 20]
primary = prod.get("MISTRAL_API_KEY","").strip()
if primary and primary not in mistral_keys:
    mistral_keys.insert(0, primary)
good, bad = 0, 0
for key in mistral_keys:
    st, _ = req("https://api.mistral.ai/v1/chat/completions",
        data={"model": "mistral-small-latest", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 4},
        headers={"Authorization": f"Bearer {key}"}, timeout=20)
    if st == 200: good += 1
    else: bad += 1
results.append((f"Mistral ({len(mistral_keys)} مفتاح)", good > 0, f"شغالين {good}/{len(mistral_keys)} — الميتين {bad}", "حصة صغيرة لكل مفتاح/شهر — بتيجي أول الشهر"))

# ---------- 7) dahl (مجمع الـ AI) — كل المفاتيح ----------
dahl_base = local.get("DAHL_BASE_URL", "https://inference.dahl.global/v1")
dahl_keys = [v for k, v in sorted(local.items()) if k.startswith("DAHL_API_KEY")]
good, bad = 0, 0
for key in dahl_keys:
    st, body = req(f"{dahl_base}/chat/completions",
        data={"model": "deepseek-ai/DeepSeek-V3", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 4},
        headers={"Authorization": f"Bearer {key}"}, timeout=20)
    if st == 200: good += 1
    else: bad += 1
results.append((f"dahl ({len(dahl_keys)} مفتاح — العقل اللي بيصنف)", good > 0, f"شغالين {good}/{len(dahl_keys)} — الميتين {bad}", "حسب المزود — لو الميتين كتير يتعمل مفاتيح جديدة"))

# ---------- 8) NVIDIA ----------
nvidia = tokens.get("NVIDIA_API_KEY") or local.get("NVIDIA_API_KEY", "")
st, body = req("https://integrate.api.nvidia.com/v1/models", headers={"Authorization": f"Bearer {nvidia}"})
note = {200: "شغال", 401: "مفتاح بايظ", 429: "الحصة خلصت مؤقتًا"}.get(st, f"HTTP {st}")
results.append(("NVIDIA (AI بديل)", st == 200, note, "40 طلب/دقيقة مجاني — بيتجدد كل دقيقة"))

# ---------- الطباعة ----------
print("=" * 66)
print("فحص لايف لكل مفاتيح LeadOS — " + __import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M"))
print("=" * 66)
for name, ok, note, tier in results:
    icon = "YES " if ok else "DEAD"
    print(f"\n[{icon}] {name}")
    print(f"   الحالة: {note}")
    print(f"   المجاني: {tier}")
