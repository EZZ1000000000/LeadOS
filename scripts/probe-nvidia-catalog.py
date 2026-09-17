#!/usr/bin/env python3
# LeadOS — مسح كل مودلات NVIDIA: مين يشتغل فعلًا وسرعته على عربي
import json
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

KEY = open("/home/z/my-project/upload/api من انفيدا ل مودلات مجانيه").read().strip()
URL = "https://integrate.api.nvidia.com/v1/chat/completions"

ALL = [
    "01-ai/yi-large", "ai21labs/jamba-1.5-large-instruct",
    "deepseek-ai/deepseek-coder-6.7b-instruct", "deepseek-ai/deepseek-v4-flash-0731",
    "google/gemma-3-12b-it", "google/gemma-3-4b-it", "google/gemma-4-31b-it",
    "google/diffusiongemma-26b-a4b-it",
    "ibm/granite-3.0-8b-instruct",
    "meta/llama-3.2-11b-vision-instruct", "meta/llama-3.2-90b-vision-instruct",
    "meta/muse-glimmer-30b",
    "microsoft/phi-3.5-moe-instruct",
    "mistralai/codestral-22b-instruct-v0.1", "mistralai/mistral-large", "mistralai/mistral-large-2-instruct",
    "mistralai/mistral-nemotron", "mistralai/mixtral-8x22b-v0.1",
    "moonshotai/kimi-k2.6", "moonshotai/kimi-k3",
    "nv-mistralai/mistral-nemo-12b-instruct",
    "nvidia/llama-3.1-nemotron-51b-instruct", "nvidia/llama-3.1-nemotron-70b-instruct",
    "nvidia/llama3-chatqa-1.5-70b", "nvidia/mistral-nemo-minitron-8b-8k-instruct",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", "nvidia/nemotron-3-super-120b-a12b",
    "nvidia/nemotron-3-ultra-550b-a55b", "nvidia/nemotron-3.5-lightning-30b-a3b",
    "nvidia/nemotron-4-340b-instruct",
    "nvidia/nemotron-nano-3-30b-a3b",
    "openai/gpt-oss-20b", "poolside/laguna-xs-2.1",
    "writer/palmyra-creative-122b", "z-ai/glm-5.3", "z-ai/glm-5.3-flash",
    "zyphra/zamba2-7b-instruct", "aisingapore/sea-lion-7b-instruct", "adept/fuyu-8b",
    "databricks/dbrx-instruct", "bigcode/starcoder2-15b",
]

def probe(model):
    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": "رد بكلمة واحدة: جاهز"}],
        "temperature": 0.1, "max_tokens": 100,
    }).encode()
    req = urllib.request.Request(URL, data=body, headers={
        "Content-Type": "application/json", "Authorization": f"Bearer {KEY}"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            d = json.loads(r.read())
        dt = int((time.time() - t0) * 1000)
        msg = d.get("choices", [{}])[0].get("message", {})
        content = (msg.get("content") or "").strip().replace("\n", " ")
        return {"model": model, "ok": True, "ms": dt, "content": content[:60],
                "reasoning": bool(msg.get("reasoning_content")), "tokens": d.get("usage", {}).get("completion_tokens")}
    except urllib.error.HTTPError as e:
        return {"model": model, "ok": False, "ms": int((time.time()-t0)*1000), "err": f"HTTP {e.code}"}
    except Exception as e:
        return {"model": model, "ok": False, "ms": int((time.time()-t0)*1000), "err": str(e)[:60]}

with ThreadPoolExecutor(max_workers=8) as ex:
    results = list(ex.map(probe, ALL))

ok = [r for r in results if r["ok"]]
dead = [r for r in results if not r["ok"]]
print(f"═══ الشغالين: {len(ok)} / {len(ALL)} ═══")
for r in sorted(ok, key=lambda x: x["ms"]):
    think = " 🧠" if r["reasoning"] else ""
    print(f"{r['ms']:>6}ms | {r['model']}{think} | {r['tokens']}tok | «{r['content']}»")
print(f"═══ الميتين (404/خطأ): {len(dead)} ═══")
print(" | ".join(r["model"] for r in dead))
