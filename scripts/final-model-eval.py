#!/usr/bin/env python3
# LeadOS — التقييم النهائي: أفضل مودل لكل مهمة (تصنيف JSON / كتابة عربي / تحليل)
import json
import time
import urllib.request

KEY = open("/home/z/my-project/upload/api من انفيدا ل مودلات مجانيه").read().strip()
URL = "https://integrate.api.nvidia.com/v1/chat/completions"

CLASSIFY = [
    {"role": "system", "content": "أنت محلل تسويق مصري. صنّف المنشور وردّ JSON فقط بدون أي كلام: {\"segment\":\"CARDS|AGENCY|BOTH\",\"score\":0-100,\"reason\":\"سطر\"}"},
    {"role": "user", "content": "المنشور: «محتاج كاشير لمطعم في مدينة نصر + عايز أعمل نظام كروت خصم للعملاء»"},
]
COMPOSE = [
    {"role": "system", "content": "أنت مساعد مبيعات مصري. ردود قصيرة."},
    {"role": "user", "content": "اكتب رد بيع من سطرين لصاحب مطعم مهتم بكروت خصم للعملاء"},
]

def call(model, msgs, max_tokens):
    body = json.dumps({"model": model, "messages": msgs, "temperature": 0.2, "max_tokens": max_tokens}).encode()
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json", "Authorization": f"Bearer {KEY}"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            d = json.loads(r.read())
        dt = int((time.time() - t0) * 1000)
        msg = d.get("choices", [{}])[0].get("message", {})
        return dt, (msg.get("content") or "").strip(), d.get("usage", {}).get("completion_tokens")
    except Exception as e:
        return int((time.time() - t0) * 1000), f"خطأ: {str(e)[:80]}", 0

TESTS = [
    ("تصنيف سريع", "meta/llama-3.2-11b-vision-instruct", CLASSIFY, 200),
    ("تصنيف سريع", "google/diffusiongemma-26b-a4b-it", CLASSIFY, 200),
    ("رئيسي", "nvidia/nemotron-3-super-120b-a12b", COMPOSE, 700),
    ("رئيسي", "nvidia/nemotron-3-ultra-550b-a55b", COMPOSE, 700),
    ("رئيسي", "openai/gpt-oss-20b", COMPOSE, 700),
    ("تحليل", "deepseek-ai/deepseek-v4-flash-0731", COMPOSE, 700),
]

for task, model, msgs, mt in TESTS:
    dt, content, tok = call(model, msgs, mt)
    good = ""
    if task == "تصنيف سريع":
        import re
        m = re.search(r'\{[^{}]*"segment"[^{}]*\}', content, re.S)
        good = f"JSON: {'✅ ' + m.group(0)[:90].replace(chr(10),' ') if m else '❌'}"
    print(f"[{task}] {model}")
    print(f"   {dt}ms | {tok}tok | {good or content[:150].replace(chr(10), ' | ')}")
