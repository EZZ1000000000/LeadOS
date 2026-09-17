#!/usr/bin/env python3
# LeadOS — ضبط كلمة سر حساب محلي للفحص (نفس صيغة scrypt في src/lib/auth.ts)
# استخدام: python3 scripts/reset-local-password.py [email] [password]
import hashlib
import secrets
import sqlite3
import sys
from datetime import datetime, timezone

DB = "/home/z/my-project/db/custom.db"
email = sys.argv[1] if len(sys.argv) > 1 else "admin@leados.ai"
password = sys.argv[2] if len(sys.argv) > 2 else "Test12345!"

salt = secrets.token_hex(16)
h = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64).hex()
stored = f"scrypt${salt}${h}"

con = sqlite3.connect(DB)
cur = con.execute(
    "UPDATE User SET passwordHash = ?, updatedAt = ? WHERE email = ?",
    (stored, datetime.now(timezone.utc).isoformat(), email),
)
con.commit()
print(f"تم: {email} → كلمة السر '{password}' ({cur.rowcount} صف)")
con.close()
