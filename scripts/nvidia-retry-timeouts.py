#!/usr/bin/env python3
# LeadOS — إعادة اختبار الموديلات اللي عملت timeout بمهلة 150 ثانية (cold start)
import json
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

KEY = open("/home/z/my-project/upload/api من انفيدا ل مودلات مجانيه").read().strip()
URL = "https://integrate.api.nvidia.com/v1/chat/completions"

RETRY = [
    "google/gemma-4-31b-it",
    "meta/llama-3.2-90b-vision-instruct",
    "meta/llama-guard-4-12b",
    "mistralai/mistral-nemotron",
    "moonshotai/kimi-k3",
    "z-ai/glm-5.3",
    "nvidia/llama-3.1-nemotron-safety-guard-8b-v3",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",  # كانت 503 ResourceExhausted
]

def probe(mid):
    body = json.dumps({
        "model": mid,
        "messages": [{"role": "user", "content": "رد بكلمة واحدة بس: جاهز"}],
        "temperature": 0.1, "max_tokens": 120,
    }).encode()
    req = urllib.request.Request(URL, data=body, headers={
        "Content-Type": "application/json", "Authorization": f"Bearer {KEY}"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=150) as r:
            d = json.loads(r.read())
        ms = int((time.time() - t0) * 1000)
        msg = d.get("choices", [{}])[0].get("message", {})
        content = (msg.get("content") or "").strip().replace("\n", " ")[:60]
        return f"✅ {ms:>6}ms {mid} 🧠={bool(msg.get('reasoning_content'))} «{content}»"
    except Exception as e:
        ms = int((time.time() - t0) * 1000)
        return f"❌ {ms:>6}ms {mid} → {str(e)[:80]}"

# توازي كامل — كل الموديلات مرة واحدة (cold start في نفس الوقت)
with ThreadPoolExecutor(max_workers=len(RETRY)) as ex:
    for line in ex.map(probe, RETRY):
        print(line, flush=True)
