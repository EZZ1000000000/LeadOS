#!/usr/bin/env python3
# استخراج وتنظيم نتايج البحث → ديجست مقروء للتركيب
import json, os, glob

SRC = "/home/z/my-project/research/expertise"
out = []
for f in sorted(glob.glob(os.path.join(SRC, "*.json"))):
    try:
        data = json.load(open(f))
    except Exception as e:
        out.append(f"\n### ⚠ {os.path.basename(f)}: قراءة فشلت ({e})")
        continue
    if not isinstance(data, list):
        continue
    out.append(f"\n\n{'='*90}\n## {os.path.basename(f).replace('.json','')}  ({len(data)} نتيجة)\n{'='*90}")
    for r in data:
        name = (r.get("name") or "").strip()
        snip = (r.get("snippet") or "").strip().replace("\n", " ")
        host = r.get("host_name") or ""
        date = r.get("date") or ""
        if snip:
            out.append(f"\n• [{host} | {date}] {name}\n  ↳ {snip[:600]}")

dst = os.path.join(SRC, "_DIGEST.md")
open(dst, "w", encoding="utf-8").write("\n".join(out))
print(f"✅ الديجست: {dst}")
print(f"الحجم: {os.path.getsize(dst)/1024:.1f} KB — {sum(1 for l in out if l.startswith('•'))} سنيبت")
