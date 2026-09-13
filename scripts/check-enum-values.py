#!/usr/bin/env python3
"""فحص منهجي: كل القيم المستخدمة في seed.ts و src مقابل enums سكيما الإنتاج"""
import re, sys, glob

SCHEMA = "/home/z/my-project/prisma/schema.production.prisma"
SCAN_FILES = ["/home/z/my-project/scripts/seed.ts"] + glob.glob("/home/z/my-project/src/**/*.ts", recursive=True) + glob.glob("/home/z/my-project/src/**/*.tsx", recursive=True)

schema = open(SCHEMA).read()

# 1) استخراج enums: اسم -> قيم
enums = {}
for m in re.finditer(r"enum\s+(\w+)\s*\{([^}]+)\}", schema):
    name, body = m.group(1), m.group(2)
    vals = [l.strip().rstrip(",") for l in body.splitlines() if l.strip() and not l.strip().startswith("//")]
    enums[name] = set(v.split()[0] for v in vals if v)

# 2) ربط الحقول بأنواعها من الموديلات: modelName.field -> EnumType
field_enum = {}
for m in re.finditer(r"model\s+(\w+)\s*\{([^}]+)\}", schema):
    model, body = m.group(1), m.group(2)
    for line in body.splitlines():
        line = line.strip()
        if not line or line.startswith("//") or line.startswith("@@"):
            continue
        fm = re.match(r"(\w+)\??\s+([\w\.]+)", line)
        if fm:
            fname, ftype = fm.group(1), fm.group(2)
            if ftype in enums:
                field_enum[fname] = ftype  # (تجاهل التكرار بين الموديلات — نفس المعنى)

# 3) مسح ملفات الاستخدام
violations = []
for path in SCAN_FILES:
    try:
        content = open(path).read()
    except Exception:
        continue
    for i, line in enumerate(content.splitlines(), 1):
        # نمط field: "VALUE" أو field: "VALUE" | "VALUE"
        for fm in re.finditer(r"(\w+)\??\s*:\s*\"([A-Z][A-Z0-9_]*)\"", line):
            fname, val = fm.group(1), fm.group(2)
            etype = field_enum.get(fname)
            if etype and val not in enums[etype]:
                violations.append(f"{path.replace('/home/z/my-project/','')}:{i}  {fname}={val}  (المسموح في {etype}: {sorted(enums[etype])})")

if violations:
    print(f"❌ {len(violations)} تعارض:\n")
    for v in sorted(set(violations)):
        print("  " + v)
else:
    print("✅ لا توجد تعارضات بين القيم المستخدمة و enums الإنتاج")
