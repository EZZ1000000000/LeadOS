#!/usr/bin/env python3
"""GitHub Actions audit: repo visibility, plan, minutes burned last 30d, secret-safety scan."""
import subprocess, json, urllib.request, urllib.error, sys, re, math
from datetime import datetime, timezone, timedelta

REPO = "EZZ1000000000/LeadOS"

def gh(path, token, method="GET"):
    req = urllib.request.Request("https://api.github.com" + path, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "leados-audit",
    }, method=method)
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode()[:150]
        except Exception:
            body = ""
        return e.code, body
    except Exception as e:
        return 0, str(e)

# token from git remote (never printed)
url = subprocess.run(["git", "config", "--get", "remote.origin.url"],
                     capture_output=True, text=True, cwd="/home/z/my-project").stdout.strip()
m = re.search(r"https://([^:]+):([^@]+)@github\.com/", url)
TOKEN = m.group(2) if m else ""
print(f"token found: {'YES (' + str(len(TOKEN)) + ' chars)' if TOKEN else 'NO'}")

# 1) repo visibility
st, repo = gh(f"/repos/{REPO}", TOKEN)
if st == 200:
    print(f"\n=== REPO ===")
    print(f"full_name : {repo['full_name']}")
    print(f"private   : {repo['private']}  <- {'PRIVATE (minutes billed!)' if repo['private'] else 'PUBLIC (minutes FREE, unlimited)'}")
    print(f"visibility: {repo.get('visibility')}")
else:
    print(f"repo check failed: {st} {repo}")

# 2) user plan
st, user = gh("/user", TOKEN)
if st == 200:
    print(f"\n=== USER/PLAN ===")
    print(f"login : {user.get('login')}")
    print(f"plan  : {user.get('plan', {}).get('name')} (free plan = 2000 private-min/month)")

# 3) billing (needs billing scope; may 403)
st, bill = gh(f"/users/EZZ1000000000/settings/billing/actions", TOKEN)
print(f"\n=== BILLING (status {st}) ===")
if st == 200:
    print(f"included_minutes : {bill.get('included_minutes')}")
    print(f"total_minutes_used: {bill.get('total_minutes_used')}")
    print(f"days_left_in_cycle: {bill.get('days_left_in_billing_cycle')}")
else:
    print("not accessible with this token scope (fine)")

# 4) recent runs -> minutes burned last 30 days
cut = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
total_min = 0.0
by_wf = {}
n = 0
page = 1
while page <= 3:
    st, data = gh(f"/repos/{REPO}/actions/runs?per_page=100&created=>={cut}&page={page}", TOKEN)
    if st != 200:
        print(f"runs fetch failed: {st}")
        break
    runs = data.get("workflow_runs", [])
    if not runs:
        break
    for r in runs:
        s, e = r.get("run_started_at"), r.get("updated_at")
        if not s or not e:
            continue
        try:
            d = (datetime.fromisoformat(e.replace("Z", "+00:00"))
                 - datetime.fromisoformat(s.replace("Z", "+00:00"))).total_seconds()
        except Exception:
            continue
        mins = max(math.ceil(d / 60), 1)  # GitHub rounds up to the minute
        wf = r.get("name", "?")
        by_wf[wf] = by_wf.get(wf, [0, 0])
        by_wf[wf][0] += 1
        by_wf[wf][1] += mins
        total_min += mins
        n += 1
    if n >= data.get("total_count", 0):
        break
    page += 1

print(f"\n=== LAST 30 DAYS RUNS ({n} runs) ===")
for wf, (cnt, mins) in sorted(by_wf.items(), key=lambda x: -x[1][1]):
    print(f"  {wf:28s} {cnt:4d} runs  ~{mins:6.0f} min")
print(f"  {'TOTAL':28s} {'':8s}  ~{total_min:6.0f} min / 30d")
if repo.get("private") if isinstance(repo, dict) else False:
    print(f"\n  -> PRIVATE repo: free quota = 2000 min/month. Burn = {total_min:.0f} => "
          f"{'EXCEEDED ALREADY' if total_min > 2000 else str(round(2000/max(total_min,1),1)) + 'x runway left'}")
else:
    print(f"\n  -> PUBLIC repo: all those minutes cost $0.00 forever.")

# 5) secret-safety scan (can we safely make it public?)
tracked = subprocess.run(["git", "ls-files"], capture_output=True, text=True,
                         cwd="/home/z/my-project").stdout.splitlines()
suspicious = [f for f in tracked if re.search(
    r"\.env|token|secret|credential|cookie|\.pem|api.*\.txt|مفتاح", f, re.I)]
print(f"\n=== TRACKED-FILE SECRET SCAN ({len(tracked)} tracked files) ===")
print("suspicious tracked files:", suspicious if suspicious else "NONE ✅")

# live key-pattern grep inside tracked text files
pats = [r"napi_[A-Za-z0-9]{20}", r"vcp_[A-Za-z0-9]{20}", r"ghp_[A-Za-z0-9]{20}",
        r"sk-[A-Za-z0-9]{20}", r"\b[0-9a-f]{40}\b"]
hits = {}
for f in tracked:
    try:
        txt = open(f, encoding="utf-8", errors="ignore").read()
    except Exception:
        continue
    for p in pats:
        if re.search(p, txt):
            hits.setdefault(f, []).append(p[:12])
print("files containing key-like patterns:", hits if hits else "NONE ✅")
