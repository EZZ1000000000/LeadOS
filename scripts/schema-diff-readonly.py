#!/usr/bin/env python3
"""Read-only schema diff: what Prisma code expects vs what Neon actually has."""
import os, subprocess, json

url = ""
for line in open("/home/z/my-project/.env.prod-runtime"):
    line = line.strip()
    if line.startswith("DATABASE_URL="):
        url = line.split("=", 1)[1].strip().strip('"')
        break
assert url and url.startswith("postgres"), "no DATABASE_URL in .env.prod-runtime"

# hide credentials for printing
safe = url.split("@")[-1] if "@" in url else url

def sql(q):
    out = subprocess.run(
        ["psql", url, "-t", "-A", "-c", q],
        capture_output=True, text=True, timeout=60,
    )
    return out.stdout.strip(), out.stderr.strip()

tables, err = sql("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1")
print("== TABLES IN NEON ==")
print(tables)
if err: print("ERR:", err)

cols, err = sql("SELECT column_name FROM information_schema.columns WHERE table_name='Lead' ORDER BY ordinal_position")
print("\n== Lead COLUMNS ==")
print(cols)
if err: print("ERR:", err)

enums, err = sql("SELECT DISTINCT unnest(enum_range(NULL::\"LeadStatus\"))::text")
print("\n== LeadStatus enum ==")
print(enums)
