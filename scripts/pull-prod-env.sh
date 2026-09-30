#!/usr/bin/env bash
# Pull production env (decrypted) from Vercel and store DATABASE_URL locally.
set -euo pipefail
cd /home/z/my-project
TOKEN="$(cat ~/.vercel_token)"
PROJ="prj_Kv9czxsvv3z84XE2JEaE1UsgtGN4"
TEAM="team_Q4xSgDiSXcvJeBFB0BvdZnNY"

curl -s "https://api.vercel.com/v9/projects/${PROJ}/env?decrypt=true&teamId=${TEAM}" \
  -H "Authorization: Bearer ${TOKEN}" > /tmp/vercel_env.json

python3 - <<'PY'
import json
data = json.load(open("/tmp/vercel_env.json"))
envs = data.get("envs", data) if isinstance(data, dict) else data
want = {"DATABASE_URL", "DIRECT_URL", "AUTH_SECRET", "CRON_SECRET", "CRON_SECRET_ALT"}
found = {}
for e in envs:
    k = e.get("key") or e.get("name")
    if k in want and e.get("value"):
        found[k] = e["value"]
with open("/home/z/my-project/.vercel-runtime-env", "w") as f:
    for k, v in sorted(found.items()):
        f.write(f"{k}={v}\n")
os = __import__("os")
os.chmod("/home/z/my-project/.vercel-runtime-env", 0o600)
print("saved keys:", sorted(found.keys()))
u = found.get("DATABASE_URL", "")
print("DB host:", u.split("@")[-1].split("/")[0] if "@" in u else "(not found)")
PY
rm -f /tmp/vercel_env.json
