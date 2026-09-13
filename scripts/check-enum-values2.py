#!/usr/bin/env python3
"""فحص موديل-واعي: داخل db.<model>.create/createMany blocks بس"""
import re, glob, json

SCHEMA = "/home/z/my-project/prisma/schema.production.prisma"
schema = open(SCHEMA).read()

enums = {}
for m in re.finditer(r"enum\s+(\w+)\s*\{([^}]+)\}", schema):
    enums[m.group(1)] = set(re.findall(r"^\s*([A-Z][A-Z0-9_]*)", m.group(2), re.M))

# model -> {field: EnumType}
model_fields = {}
for m in re.finditer(r"model\s+(\w+)\s*\{([^}]+)\}", schema):
    model, body = m.group(1), m.group(2)
    fields = {}
    for line in body.splitlines():
        line = line.strip()
        if not line or line.startswith("//") or line.startswith("@@"):
            continue
        fm = re.match(r"(\w+)\??\s+([\w\.]+)", line)
        if fm and fm.group(2) in enums:
            fields[fm.group(1)] = fm.group(2)
    model_fields[model] = fields

def brace_block(content, start):
    """ارجع محتوى البلوك من أول { بعد start"""
    i = content.index("{", start)
    depth, j = 0, i
    while j < len(content):
        if content[j] == "{": depth += 1
        elif content[j] == "}":
            depth -= 1
            if depth == 0: return content[i+1:j]
        j += 1
    return content[i:]

violations = {}
def check(model, block, path, base_line):
    fields = model_fields.get(model, {})
    for fm in re.finditer(r"(\w+)\??\s*:\s*\"([A-Z][A-Z0-9_]*)\"", block):
        fname, val = fm.group(1), fm.group(2)
        etype = fields.get(fname)
        if etype and val not in enums[etype]:
            key = f"{path}:{base_line}  {model}.{fname}={val}"
            violations[key] = f"  {model}.{fname} = {val}  ← غير موجود في enum {etype} {sorted(enums[etype])}"

# 1) seed.ts — بلوكات db.X.create/update/createMany (مع احتساب أسطر)
seed_lines = open("/home/z/my-project/scripts/seed.ts").read().splitlines()
seed_src = "\n".join(seed_lines)
# احسب إزاحة كل سطر
line_offsets = [0]
for l in seed_lines: line_offsets.append(line_offsets[-1] + len(l) + 1)

for m in re.finditer(r"db\.(\w+)\.(create|createMany|update|upsert)\s*\(", seed_src):
    model, meth = m.group(1), m.group(2)
    block = brace_block(seed_src, m.end() - 1)
    ln = next((i for i, off in enumerate(line_offsets) if off > m.start()), len(seed_lines))
    # أسطر الكتلة للسياق
    ctx = seed_lines[ln-1][:90] if ln-1 < len(seed_lines) else ""
    check(model, block, f"seed.ts:{ln}", ln)

# 2) للسياق التفسيري فقط — اطبع الـctx لأول بلوك leads array (السطور 360-460)
print("=== سياق مصفوفة الليدز في السيد (365-375) ===")
for i in range(364, 375):
    print(f"{i+1}: {seed_lines[i].rstrip()[:110]}")
print()

# 3) src/** — بلوكات db.X.create/update/createMany
for path in glob.glob("/home/z/my-project/src/**/*.ts", recursive=True):
    content = open(path).read()
    for m in re.finditer(r"db\.(\w+)\.(create|createMany|update|upsert)\s*\(", content):
        block = brace_block(content, m.end() - 1)
        line_no = content[:m.start()].count("\n") + 1
        check(m.group(1), block, path.replace("/home/z/my-project/", "") + f":{line_no}", line_no)

print(f"=== ✗ {len(violations)} تعارض حقيقي داخل بلوكات إنشاء ===")
for v in sorted(violations.values()):
    print(v)
