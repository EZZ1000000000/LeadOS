#!/usr/bin/env python3
"""Audit every dashboard API endpoint on production with a real session."""
import json, urllib.request, urllib.error, http.cookiejar, sys

BASE = "https://leados-olive.vercel.app"
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def req(path, method="GET", data=None, timeout=45):
    url = BASE + path
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, method=method)
    r.add_header("Content-Type", "application/json")
    try:
        with opener.open(r, timeout=timeout) as resp:
            raw = resp.read()[:400]
            return resp.status, raw.decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:400].decode("utf-8", "replace")
    except Exception as e:
        return -1, str(e)[:200]

# 1) login
creds = json.load(open("/home/z/my-project/.dashboard-creds.json")) if __import__("os").path.exists("/home/z/my-project/.dashboard-creds.json") else {}
email = creds.get("email", "samgany278@gmail.com")
pw = creds.get("password", "Zizo@2026")
st, out = req("/api/auth/login", "POST", {"email": email, "password": pw})
print(f"LOGIN /api/auth/login -> {st} :: {out[:160]}")
if st not in (200, 201):
    print("!! login failed — cannot test authed endpoints")
    sys.exit(1)

ENDPOINTS = [
    "/api/me", "/api/overview", "/api/groups", "/api/feed", "/api/leads",
    "/api/pipeline", "/api/research", "/api/sources", "/api/rules",
    "/api/sequences", "/api/chat", "/api/agent/runs", "/api/agent/entity",
    "/api/agent/memory", "/api/agent/zizo", "/api/analytics", "/api/tasks",
    "/api/alerts", "/api/settings/ai", "/api/skills", "/api/experiments",
    "/api/platforms", "/api/platforms/sessions", "/api/accounts",
]
ok, bad = [], []
for ep in ENDPOINTS:
    st, out = req(ep)
    tag = "OK " if st == 200 else "BAD"
    (ok if st == 200 else bad).append((ep, st, out))
    print(f"{tag} {ep:28s} -> {st} :: {out[:150]}")

print("\n===== SUMMARY =====")
print(f"OK: {len(ok)}   BAD: {len(bad)}")
for ep, st, out in bad:
    print(f"  BAD {ep} {st}: {out[:220]}")
