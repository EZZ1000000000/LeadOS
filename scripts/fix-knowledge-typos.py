#!/usr/bin/env python3
# إصلاح أخطاء كتابة في knowledge.ts + نقل الاستيراد لأعلى
import re, io

p = "/home/z/my-project/src/lib/agent/zizo/knowledge.ts"
s = io.open(p, encoding="utf-8").read()

fixes = [
    # نقل الاستيراد لأعلى (استيراد كسول في آخر الملف)
    ('\n// يُستورد كسولًا لتفادي دورات الاستيراد\nimport { db } from "@/lib/db"\n', ""),
    # إدخال الاستيراد بعد أول سطر تعليقي
    ("(AgentInsight)", '(AgentInsight)\nimport { db } from "@/lib/db"'),
    # أخطاء كتابة
    ("ويتبادlwا توريدات", "ويتبادلوا توريدات"),
    ("بتدوروا على مغلوب أمانة", "بتدوروا على حد موثوق"),
    ('name: "أولين سوق + هاتلا2ee', 'name: "أوليكس (OLX) + هاتلا2ee'),
    ("مصح|مستشفى", "مستشفى|مركز طبي"),
    ("بتكلفة أقل ومهرا خاطر", "بتكلفة أقل وبدون صداع توظيف"),
    ('"أولين سوق (اللي بيكبروا منه)"', '"أوليكس OLX (اللي بيكبروا منه)"'),
]
for old, new in fixes:
    if old in s:
        s = s.replace(old, new)
        print("OK:", old[:40])
    else:
        print("SKIP:", old[:40])

io.open(p, "w", encoding="utf-8").write(s)

# تحقق
s2 = io.open(p, encoding="utf-8").read()
assert 'import { db } from "@/lib/db"' in s2, "db import missing!"
assert s2.count('import { db }') == 1, "duplicate db import!"
assert "lw" not in s2, "typo remains!"
print("=== knowledge.ts fixed ===")
