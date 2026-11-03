#!/usr/bin/env bash
# LeadOS — Codespace one-shot setup (auto-runs on server creation)
set -u
cd /workspaces/LeadOS

echo "[LeadOS] 1/5 bun runtime..."
if ! command -v bun >/dev/null 2>&1; then
  npm install -g bun >/dev/null 2>&1 || npm install -g bun
fi
bun --version

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

for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3000/ || true)
  if [ "$code" = "200" ]; then echo "[LeadOS] server UP"; break; fi
  sleep 3
done

echo "[LeadOS] admin account..."
curl -s -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ezz Admin","email":"admin@leados.com","password":"EzzAdmin2026","workspaceName":"Ezz Company"}' || true
echo ""
echo "[LeadOS] SETUP DONE"
