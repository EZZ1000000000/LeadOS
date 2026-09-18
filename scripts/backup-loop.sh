#!/usr/bin/env bash
# LeadOS — periodic DB backup loop (every 30 minutes)
# Started alongside the dev server; dies on restart (the "dev" script
# re-runs a startup backup anyway, so nothing is lost).
cd /home/z/my-project || exit 1
mkdir -p db/backups
while true; do
  sleep 1800
  bun run scripts/backup-db.ts scheduled >> db/backups/backup.log 2>&1 || true
done
