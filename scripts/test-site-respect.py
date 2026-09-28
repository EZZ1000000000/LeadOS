"""اختبار من يحترم site: فعلاً: بنج مباشر / Exa includeDomains / zai web_search"""
import urllib.request, urllib.parse, re, base64, json, ssl
from pathlib import Path

ctx = ssl.create_default_context()
env = {}
for line in Path("/home/z/my-project/.env.vercel-prod").read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"')

def bing_domains(q):
    url = "https://www.bing.com/search?" + urllib.parse.urlencode({"q": q, "count": "15", "mkt": "en-US"})
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36"})
    try:
        with urllib.request.urlopen(req, timeout=25, context=ctx) as r:
            b = r.read().decode("utf-8", "ignore")
    except Exception as e:
        return ["ERROR: " + str(e)[:40]]
    doms = []
    # robust: لكل li b_algo، خد أول href جواه
    for block in re.split(r'<li class="b_algo', b)[1:]:
        m = re.search(r'href="(https?://[^"]+)"', block)
        if not m:
            continue
        u = m.group(1)
        if "bing.com/ck/a" in u:
            mm = re.search(r'[&?]u=a1([A-Za-z0-9_-]+)', u)
            if mm:
                pad = mm.group(1) + "=" * (-len(mm.group(1)) % 4)
                try:
                    u = base64.urlsafe_b64decode(pad).decode("utf-8", "ignore")
                except Exception:
                    pass
        try:
            doms.append(u.split("/")[2].replace("www.", ""))
        except Exception:
            pass
    return doms[:8]

print("=== 1) بنج مباشر: site:linkedin.com cairo dentist ===")
print(bing_domains("site:linkedin.com cairo dentist"))

print("\n=== 2) Exa بفلتر includeDomains (مضمون بنيويًا) ===")
try:
    req = urllib.request.Request("https://api.exa.ai/search",
        data=json.dumps({"query": "عيادة أسنان القاهرة", "numResults": 8,
                          "includeDomains": ["linkedin.com"], "type": "auto"}).encode(),
        headers={"x-api-key": env["EXA_API_KEY"], "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        data = json.loads(r.read())
    doms = []
    for res in data.get("results", []):
        try: doms.append(res["url"].split("/")[2].replace("www.", ""))
        except Exception: pass
    print("الدومينات:", doms)
    titles = [res.get("title", "")[:45] for res in data.get("results", [])[:4]]
    print("عناوين:", titles)
except Exception as e:
    print("Exa فشل:", str(e)[:100])

print("\n=== 3) هل استعلاماتنا الحالية بتوصل Exa أصلًا؟ (الرصيد) ===")
try:
    req = urllib.request.Request("https://api.exa.ai/search",
        data=json.dumps({"query": "test", "numResults": 1}).encode(),
        headers={"x-api-key": env["EXA_API_KEY"], "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        print("Exa لسه شغال ✅")
except Exception as e:
    print("Exa مات:", str(e)[:80])
