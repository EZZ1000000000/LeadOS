#!/usr/bin/env python3
# LeadOS — اختبار مرشحي NVIDIA NIM لكل مهمة (سرعة + عربي + JSON)
import json
import time
import urllib.request

KEY = open("/home/z/my-project/upload/api من انفيدا ل مودلات مجانيه").read().strip()
URL = "https://integrate.api.nvidia.com/v1/chat/completions"

CLASSIFY_MSGS = [
    {"role": "system", "content": "أنت محلل تسويق مصري. صنّف المنشور وردّ JSON فقط بدون أي كلام زائد: {\"segment\":\"CARDS|AGENCY|BOTH\",\"score\":0-100,\"reason\":\"سطر واحد\"}"},
    {"role": "user", "content": "المنشور: «محتاج كاشير لمطعم في مدينة نصر + عايز أعمل نظام كروت خصم للعملاء»"},
]
COMPOSE_MSGS = [
    {"role": "system", "content": "أنت مساعد مبيعات مصري. ردود قصيرة جدًا."},
    {"role": "user", "content": "اكتب رد بيع من سطرين لصاحب مطعم مهتم بكروت خصم للعملاء"},
]

def call(model, msgs, max_tokens=200):
    body = json.dumps({"model": model, "messages": msgs, "temperature": 0.2, "max_tokens": max_tokens}).encode()
    req = urllib.request.Request(URL, data=body, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {KEY}",
    })
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            d = json.loads(r.read())
        dt = int((time.time() - t0) * 1000)
        msg = d.get("choices", [{}])[0].get("message", {})
        content = (msg.get("content") or "").strip()
        reasoning = bool(msg.get("reasoning_content"))
        usage = d.get("usage", {})
        return {"ok": True, "ms": dt, "content": content, "reasoning_field": reasoning, "tokens": usage.get("completion_tokens")}
    except Exception as e:
        return {"ok": False, "ms": int((time.time() - t0) * 1000), "error": str(e)[:120]}

CANDIDATES_FAST = ["nvidia/nemotron-3.5-lightning-30b-a3b", "mistralai/mistral-7b-instruct-v0.3", "z-ai/glm-5.3-flash"]
CANDIDATES_MAIN = ["moonshotai/kimi-k2.6", "mistralai/mistral-large-2-instruct", "nvidia/llama-3.1-nemotron-70b-instruct"]
CANDIDATES_REASON = ["deepseek-ai/deepseek-v4-flash-0731"]

print("═══ اختبار التصنيف (JSON عربي) ═══")
for m in CANDIDATES_FAST:
    r = call(m, CLASSIFY_MSGS, 150)
    if r["ok"]:
        has_json = '"segment"' in r["content"]
        print(f"[{m}] {r['ms']}ms | JSON صحيح: {has_json} | tokens: {r['tokens']}")
        print(f"   → {r['content'][:140].replace(chr(10),' | ')}")
    else:
        print(f"[{m}] فشل بعد {r['ms']}ms: {r['error']}")

print("═══ اختبار الرئيسي (عربي طبيعي) ═══")
for m in CANDIDATES_MAIN:
    r = call(m, COMPOSE_MSGS, 150)
    if r["ok"]:
        print(f"[{m}] {r['ms']}ms | tokens: {r['tokens']}")
        print(f"   → {r['content'][:160].replace(chr(10),' | ')}")
    else:
        print(f"[{m}] فشل بعد {r['ms']}ms: {r['error']}")

print("═══ اختبار التفكير العميق ═══")
for m in CANDIDATES_REASON:
    r = call(m, COMPOSE_MSGS, 300)
    if r["ok"]:
        print(f"[{m}] {r['ms']}ms | حقل تفكير منفصل: {r['reasoning_field']} | tokens: {r['tokens']}")
        print(f"   → {r['content'][:160].replace(chr(10),' | ')}")
    else:
        print(f"[{m}] فشل بعد {r['ms']}ms: {r['error']}")
