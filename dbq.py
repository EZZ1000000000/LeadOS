#!/usr/bin/env python3
"""dbq — تشغيل SQL على قواعد LeadOS من الترمينال.

الاستخدام:
  python3 dbq.py DATABASE_URL "SELECT 1"
  python3 dbq.py NEON_LEADOS_POOLED "SELECT count(*) FROM \"Lead\""
  python3 dbq.py local "SELECT 1"

أسماء معروفة: NEON_LEADOS_POOLED / NEON_LEADOS → بتتقرا من scripts/deploy/.tokens
(سطر فيه DATABASE_URL=...) أو من متغير البيئة DATABASE_URL. local → SQLite Dev.
"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent  # dbq.py في جذر المشروع
TOKENS = ROOT / "scripts" / "deploy" / ".tokens"


def resolve(name: str) -> str:
    # متغير بيئة مباشر
    if v := os.environ.get(name):
        return v
    if name.upper() in ("DATABASE_URL",) or name.startswith("postgres"):
        return name
    # أسماء مستعارة من ملف التوكنات
    if TOKENS.exists():
        env: dict[str, str] = {}
        for line in TOKENS.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, val = line.partition("=")
            env[k.strip()] = val.strip().strip('"').strip("'")
        if v := env.get(name):
            return v
        if v := env.get("DATABASE_URL"):
            if name.upper() in ("NEON_LEADOS", "NEON_LEADOS_POOLED", "PROD", "NEON"):
                return v
    if name == "local":
        return f"sqlite://{ROOT / 'db' / 'custom.db'}"
    raise SystemExit(
        f"مش لاقي '{name}' — حط DATABASE_URL في متغير البيئة أو سطر DATABASE_URL=... في {TOKENS}"
    )


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    name, sql = sys.argv[1], sys.argv[2]
    url = resolve(name)
    try:
        import psycopg  # type: ignore
    except ImportError:
        os.system("pip install -q 'psycopg[binary]' >/dev/null 2>&1")
        import psycopg  # type: ignore

    if not url.startswith(("postgres", "postgresql")):
        raise SystemExit(f"الرابط مش Postgres ({url[:30]}...) — سكربت ده للـNeon/Postgres بس")
    with psycopg.connect(url, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            if cur.description is None:
                print("OK")
                return
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
            print(json.dumps([dict(zip(cols, r)) for r in rows], ensure_ascii=False, indent=1, default=str))


if __name__ == "__main__":
    main()
