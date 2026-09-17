#!/usr/bin/env python3
# LeadOS — مسح حي شامل لكل مودلات NVIDIA في الـAPI:
#   المرحلة A: جلب الكتالوج الكامل /v1/models
#   المرحلة B: ping عربي لكل موديل شات + إيمبدنج لنماذج الـembedding
#   المرحلة C: اختبار JSON صارم (تصنيف عربي) للشغالين
#   المرحلة D: اختبار tool-calling للشغالين
#   المرحلة E: اختبار رؤية (صورة) لموديلات vision/omni/vl
# النتيجة: scripts/nvidia-catalog-live.json + تقرير مقروء
import base64
import json
import os
import re
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

KEY = open("/home/z/my-project/upload/api من انفيدا ل مودلات مجانيه").read().strip()
BASE = "https://integrate.api.nvidia.com/v1"
OUT = "/home/z/my-project/scripts/nvidia-catalog-live.json"

def req(path, body=None, timeout=60):
    r = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {KEY}"},
        method="POST" if body is not None else "GET",
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return int((time.time() - t0) * 1000), json.loads(resp.read()), None
    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode()[:120]
        except Exception:
            detail = ""
        return int((time.time() - t0) * 1000), None, f"HTTP {e.code} {detail}"
    except Exception as e:
        return int((time.time() - t0) * 1000), None, str(e)[:120]

# ─── المرحلة A: الكتالوج ───
_, cat, err = req("/models")
if err:
    raise SystemExit(f"فشل جلب الكتالوج: {err}")
ids = sorted(m["id"] for m in cat.get("data", []))
print(f"═══ A) الكتالوج الحي: {len(ids)} موديل ═══")

EMBED_PAT = re.compile(r"embed|retriev|rerank|rank", re.I)
VISION_PAT = re.compile(r"vision|omni|-vl|vlm|image|fuyu|muse", re.I)

# 1x1 PNG أحمر (أصغر صورة صالحة)
TINY_PNG = base64.b64encode(base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)).decode()

def probe_chat(mid):
    _, d, e = req("/chat/completions", {
        "model": mid,
        "messages": [{"role": "user", "content": "رد بكلمة واحدة بس: جاهز"}],
        "temperature": 0.1, "max_tokens": 120,
    })
    if e or not d:
        return {"id": mid, "kind": "chat", "ok": False, "err": e}
    msg = d.get("choices", [{}])[0].get("message", {})
    return {
        "id": mid, "kind": "chat", "ok": True,
        "ms": _[0] if False else None,
        "latency_ms": None,
        "content": (msg.get("content") or "").strip().replace("\n", " ")[:80],
        "reasoning": bool(msg.get("reasoning_content")),
        "completion_tokens": d.get("usage", {}).get("completion_tokens"),
    }

def probe_chat_t(mid):
    t0 = time.time()
    _, d, e = req("/chat/completions", {
        "model": mid,
        "messages": [{"role": "user", "content": "رد بكلمة واحدة بس: جاهز"}],
        "temperature": 0.1, "max_tokens": 120,
    }, timeout=75)
    ms = int((time.time() - t0) * 1000)
    if e or not d:
        return {"id": mid, "kind": "chat", "ok": False, "err": e, "latency_ms": ms}
    msg = d.get("choices", [{}])[0].get("message", {})
    return {
        "id": mid, "kind": "chat", "ok": True, "latency_ms": ms,
        "content": (msg.get("content") or "").strip().replace("\n", " ")[:80],
        "reasoning": bool(msg.get("reasoning_content")),
        "completion_tokens": d.get("usage", {}).get("completion_tokens"),
    }

def probe_embed(mid):
    _, d, e = req("/embeddings", {
        "model": mid,
        "input": ["مطعم محتاج نظام كروت خصم", "كافيه يبحث عن كاشير"],
        "input_type": "query", "truncate": "END",
    }, timeout=45)
    if e or not d:
        return {"id": mid, "kind": "embed", "ok": False, "err": e}
    vecs = d.get("data") or []
    dim = len(vecs[0].get("embedding", [])) if vecs else 0
    return {"id": mid, "kind": "embed", "ok": dim > 0, "dim": dim, "err": None if dim else "no vectors"}

CLASSIFY_MSGS = [
    {"role": "system", "content": "صنّف المنشور وردّ JSON فقط بدون أي كلام: {\"segment\":\"CARDS|AGENCY|BOTH\",\"score\":0-100,\"reason\":\"سطر\"}"},
    {"role": "user", "content": "المنشور: «محتاج كاشير لمطعم في مدينة نصر + عايز نظام كروت خصم للعملاء»"},
]

def probe_json(mid):
    _, d, e = req("/chat/completions", {
        "model": mid, "messages": CLASSIFY_MSGS, "temperature": 0.1, "max_tokens": 220,
    }, timeout=75)
    if e or not d:
        return {"ok": False}
    txt = (d.get("choices", [{}])[0].get("message", {}).get("content") or "")
    m = re.search(r'\{[^{}]*"segment"[^{}]*\}', txt, re.S)
    if not m:
        return {"ok": False}
    try:
        j = json.loads(m.group(0))
        return {"ok": j.get("segment") in ("CARDS", "AGENCY", "BOTH"),
                "segment": j.get("segment"), "score": j.get("score")}
    except Exception:
        return {"ok": False}

TOOLS = [{
    "type": "function",
    "function": {
        "name": "search_leads",
        "description": "يبحث في قاعدة العملاء المحتملين",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string"}, "city": {"type": "string"}},
            "required": ["query"]},
    },
}]

def probe_tools(mid):
    _, d, e = req("/chat/completions", {
        "model": mid,
        "messages": [{"role": "user", "content": "دوّر في الليدز على مطاعم في القاهرة"}],
        "tools": TOOLS, "tool_choice": "auto",
        "temperature": 0.1, "max_tokens": 300,
    }, timeout=75)
    if e or not d:
        return {"ok": False, "err": (e or "")[:60]}
    msg = d.get("choices", [{}])[0].get("message", {})
    tc = msg.get("tool_calls") or []
    if tc and tc[0].get("function", {}).get("name") == "search_leads":
        try:
            args = json.loads(tc[0]["function"].get("arguments") or "{}")
            return {"ok": "query" in args, "args": args}
        except Exception:
            return {"ok": False}
    return {"ok": False}

def probe_vision(mid):
    _, d, e = req("/chat/completions", {
        "model": mid,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": "ما لون الصورة؟ رد بكلمة واحدة."},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{TINY_PNG}"}},
        ]}],
        "temperature": 0.1, "max_tokens": 150,
    }, timeout=75)
    if e or not d:
        return {"ok": False, "err": (e or "")[:60]}
    txt = (d.get("choices", [{}])[0].get("message", {}).get("content") or "").strip()
    return {"ok": bool(txt), "content": txt[:60]}

# ─── المرحلة B: مسح كل موديل ───
chat_ids = [m for m in ids if not EMBED_PAT.search(m)]
embed_ids = [m for m in ids if EMBED_PAT.search(m)]

print(f"── B) مسح {len(chat_ids)} موديل شات + {len(embed_ids)} موديل إيمبدنج/ترتيب ──")
with ThreadPoolExecutor(max_workers=6) as ex:
    chat_res = list(ex.map(probe_chat_t, chat_ids))
embed_res = []
for mid in embed_ids:
    embed_res.append(probe_embed(mid))
    time.sleep(0.3)

alive = [r for r in chat_res if r["ok"]]
dead = [r for r in chat_res if not r["ok"]]
alive_embed = [r for r in embed_res if r["ok"]]

print(f"شغالين شات: {len(alive)} | ميتين: {len(dead)} | إيمبدنج شغال: {len(alive_embed)}")

# ─── المرحلة C: JSON للشغالين ───
print(f"── C) اختبار JSON الصارم على {len(alive)} شغال ──")
for r in alive:
    r["json"] = probe_json(r["id"])
    time.sleep(0.2)

# ─── المرحلة D: tool-calling للشغالين ───
print(f"── D) اختبار tool-calling على {len(alive)} شغال ──")
for r in alive:
    r["tools"] = probe_tools(r["id"])
    time.sleep(0.2)

# ─── المرحلة E: رؤية للمرشحين البصريين ───
vision_ids = [r["id"] for r in alive if VISION_PAT.search(r["id"])]
print(f"── E) اختبار رؤية على {len(vision_ids)} مرشح بصري ──")
vision_res = {}
for mid in vision_ids:
    vision_res[mid] = probe_vision(mid)
    time.sleep(0.2)
for r in alive:
    if r["id"] in vision_res:
        r["vision"] = vision_res[r["id"]]

result = {
    "scanned_at": time.strftime("%Y-%m-%d %H:%M"),
    "catalog_size": len(ids),
    "models": chat_res + embed_res,
}
with open(OUT, "w") as f:
    json.dump(result, f, ensure_ascii=False, indent=1)

# ─── التقرير ───
print("\n═══ الشغالين (مرتبين بالسرعة) ═══")
flags = lambda r: ("🧠" if r.get("reasoning") else "  ") + ("JSON✅" if r.get("json", {}).get("ok") else "----") + ("🛠️" if r.get("tools", {}).get("ok") else "──") + ("👁️" if r.get("vision", {}).get("ok") else "──")
for r in sorted(alive, key=lambda x: x["latency_ms"] or 99999):
    print(f"{r['latency_ms']:>6}ms {flags(r)} {r['id']} | «{r['content'][:40]}»")
print("\n═══ الميتين ═══")
for r in dead:
    print(f"  ❌ {r['id']} → {r.get('err', '')[:70]}")
print("\n═══ إيمبدنج ═══")
for r in embed_res:
    if r["ok"]:
        print(f"  ✅ {r['id']} dim={r['dim']}")
    else:
        print(f"  ❌ {r['id']} → {r.get('err', '')[:60]}")
print(f"\nمحفوظ: {OUT}")
