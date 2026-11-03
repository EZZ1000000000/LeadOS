#!/usr/bin/env bash
# LeadOS — Codespace one-shot setup (auto-runs on server creation)
set -u
cd /workspaces/LeadOS
LOG=setup-status.log
exec > >(tee -a "$LOG") 2>&1

echo "[LeadOS] setup started: $(date -u +%FT%TZ)"
echo "[LeadOS] 0/5 curl check..."
command -v curl >/dev/null 2>&1 || (sudo apt-get update -qq >/dev/null 2>&1; sudo apt-get install -y -qq curl) || true

echo "[LeadOS] 1/5 bun runtime..."
if ! command -v bun >/dev/null 2>&1; then
  npm install -g bun >/dev/null 2>&1 || npm install -g bun
fi
bun --version || true

echo "[LeadOS] 2/5 dependencies..."
bun install

echo "[LeadOS] 3/5 environment..."
mkdir -p db
if [ ! -f .env ]; then
  SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  printf 'DATABASE_URL=file:/workspaces/LeadOS/db/custom.db\nAUTH_SECRET=%s\n' "$SECRET" > .env
  chmod 600 .env
fi

echo "[LeadOS] 4/5 database (65 tables)..."
bun run db:push

echo "[LeadOS] 5/5 starting app..."
if ! curl -s -o /dev/null --max-time 3 http://localhost:3000/; then
  nohup bun run dev > /workspaces/LeadOS/dev.log 2>&1 &
fi

UP=0
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3000/ || true)
  if [ "$code" = "200" ]; then echo "[LeadOS] server UP"; UP=1; break; fi
  sleep 3
done

if [ "$UP" = "1" ]; then
  echo "[LeadOS] admin account..."
  curl -s -X POST http://localhost:3000/api/auth/register \
    -H 'Content-Type: application/json' \
    -d '{"name":"Ezz Admin","email":"admin@leados.com","password":"EzzAdmin2026","workspaceName":"Ezz Company"}' || true
  echo ""
else
  echo "[LeadOS] WARN: server did not come up — dev.log tail:"
  tail -20 /workspaces/LeadOS/dev.log 2>/dev/null || true
fi
echo "[LeadOS] SETUP DONE: $(date -u +%FT%TZ)"

# push the status log to the branch for remote visibility
git config user.name "LeadOS Setup" >/dev/null 2>&1 || true
git config user.email "setup@leados.local" >/dev/null 2>&1 || true
git add -f "$LOG" 2>/dev/null && git commit -m "[skip ci] codespace setup log" 2>/dev/null && git push origin HEAD:deploy/codespace 2>/dev/null || echo "[LeadOS] (log push skipped)"
