#!/usr/bin/env python3
"""Sanitize 6 files: replace hardcoded secrets with env/file reads. Idempotent."""
import re, shutil, sys, os

os.chdir("/home/z/my-project")
os.makedirs(".secrets-local/stash", exist_ok=True)

def patch(path, subs, required=True):
    if not os.path.exists(path):
        print(f"SKIP {path} (missing)"); return
    shutil.copy2(path, f".secrets-local/stash/{os.path.basename(path)}")
    txt = open(path, encoding="utf-8").read()
    orig = txt
    for pat, rep, n in subs:
        txt2, cnt = re.subn(pat, rep, txt)
        if n and cnt != n:
            print(f"WARN {path}: pattern {pat[:40]!r} matched {cnt}x (expected {n})")
        txt = txt2
    if txt != orig:
        open(path, "w", encoding="utf-8").write(txt)
        print(f"PATCHED {path}")
    else:
        print(f"NOCHANGE {path}")

# 1) test-zenrows-keys.py — KEYS list -> env
patch("scripts/test-zenrows-keys.py", [(
    r"KEYS = \[\n(?:\s+\"[0-9a-f]{40}\",?\n)+\s*\]",
    'KEYS = [k.strip() for k in os.environ.get("ZENROWS_API_KEYS", "").split(",") if k.strip()]\n'
    'if not KEYS:\n    raise SystemExit("set ZENROWS_API_KEYS env var (comma-separated)")',
    1)])
# add os import if missing
p = "scripts/test-zenrows-keys.py"
t = open(p, encoding="utf-8").read()
if "import os" not in t:
    t = t.replace("import urllib.request", "import os\nimport urllib.request", 1)
    open(p, "w", encoding="utf-8").write(t)
    print("added os import ->", p)

# 2) test-cheap-serp.py — K1 -> env
patch("scripts/test-cheap-serp.py", [(
    r'K1 = "[0-9a-f]{40}"',
    'K1 = os.environ.get("ZENROWS_API_KEYS", "").split(",")[0].strip()',
    1)])
p = "scripts/test-cheap-serp.py"
t = open(p, encoding="utf-8").read()
if "import os" not in t:
    t = t.replace("import urllib.request", "import os\nimport urllib.request", 1)
    open(p, "w", encoding="utf-8").write(t)
    print("added os import ->", p)

# 3) test-serp-scrape.ts — hardcoded env assignment -> require real env
patch("scripts/test-serp-scrape.ts", [(
    r'process\.env\.ZENROWS_API_KEYS = \[\n(?:\s+"[0-9a-f]{40}",?\n)+\]\.join\(","\)',
    'if (!process.env.ZENROWS_API_KEYS) {\n  throw new Error("ZENROWS_API_KEYS env var required")\n}',
    1)])

# 4) set-vercel-env.sh — TOKEN -> source .tokens
patch("scripts/set-vercel-env.sh", [(
    r'TOKEN="vcp_[A-Za-z0-9]{20,}"',
    '#VERCEL_TOKEN now sourced from scripts/deploy/.tokens (untracked)\n'
    'source "$(dirname "$0")/deploy/.tokens" 2>/dev/null || source .secrets-local/deploy-tokens\n'
    'TOKEN="${VERCEL_TOKEN:?VERCEL_TOKEN required in scripts/deploy/.tokens}"',
    1)])

# 5+6) deploy-loop.sh / deploy-watch.sh — VT -> source .tokens
for f in [".zscripts/deploy-loop.sh", ".zscripts/deploy-watch.sh"]:
    patch(f, [(
        r'VT="vcp_[A-Za-z0-9]{20,}"',
        'source /home/z/my-project/scripts/deploy/.tokens 2>/dev/null || source /home/z/my-project/.secrets-local/deploy-tokens\n'
        'VT="${VERCEL_TOKEN:?VERCEL_TOKEN required}"',
        1)])

# FINAL VERIFY: no key patterns remain in these files
pats = [r"vcp_[A-Za-z0-9]{20,}", r"\b[0-9a-f]{40}\b"]
bad = 0
for f in ["scripts/test-zenrows-keys.py", "scripts/test-cheap-serp.py", "scripts/test-serp-scrape.ts",
          "scripts/set-vercel-env.sh", ".zscripts/deploy-loop.sh", ".zscripts/deploy-watch.sh"]:
    t = open(f, encoding="utf-8").read()
    for p in pats:
        ms = re.findall(p, t)
        if ms:
            print(f"STILL DIRTY: {f} -> {p} x{len(ms)}"); bad += 1
print("SANITIZE " + ("FAILED" if bad else "OK ✅"))
sys.exit(1 if bad else 0)
