# LeadOS — تشخيص حي: فيسبوك غيّر DOM المحلل؟
# نشغّل من داخل بيئة الإنتاج (نفس السركتس) وننادي خدمة الكامو فوكس المنتشرة
# الاستخدام: python3 -m modal run scripts/deploy/diag_fb_modal.py

import modal

app = modal.App("leados-diag-fb")

image = modal.Image.debian_slim(python_version="3.11").pip_install("urllib3")

GROUPS = [
    "اصحابكافيهاتومطاعممصر",       # اللي كانت شغالة إمبارح
    "كافيهاتومطاعممصر",
]


@app.function(image=image, timeout=240, secrets=[modal.Secret.from_name("leados-tick"), modal.Secret.from_name("camoufox-token")])
def diag() -> None:
    import json
    import os
    import re
    import time
    import urllib.request

    base = (os.environ.get("CAMOUFOX_URL") or "").rstrip("/")
    if not base:
        print("❌ مفيش CAMOUFOX_URL في السركتس")
        return
    tok = os.environ.get("CAMOUFOX_TOKEN", "")
    print("CAMOUFOX_URL:", base[:40], "| توكن موجود:", bool(tok))

    def post(path: str, payload: dict, timeout: int = 90) -> dict:
        req = urllib.request.Request(
            base + path,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json", "x-leados-token": tok},
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())

    print("صحة الخدمة:", post("/health", {}, 20))

    for g in GROUPS:
        url = f"https://www.facebook.com/groups/{g}/posts/"
        print(f"\n════════ جروب: {g} ════════")
        try:
            nav = post("/navigate", {"session": "fbdiag", "url": url, "wait_until": "domcontentloaded", "timeout_ms": 45000, "scroll_times": 4})
            print("navigate:", {k: nav.get(k) for k in ("ok", "http_status", "title")}, "| نص:", len(nav.get("text") or ""))
            time.sleep(3)
            ev = post("/act", {"session": "fbdiag", "action": "eval", "script": "document.documentElement.outerHTML"}, 120)
            html = ev.get("result") or ""
            print("حجم HTML:", len(html) // 1024, "KB")

            sigs = {
                "Story typename": '"__typename":"Story"',
                "post_id": '"post_id"',
                "message.text": '"message":{"text"',
                "creation_time": '"creation_time":',
                "feedback_target": '"feedback_target"',
                "__isFeedUnit": '"__isFeedUnit"',
                "story_fbid": "story_fbid",
                "top_level_post_id": "top_level_post_id",
                "login_form": "login_form",
            }
            for name, pat in sigs.items():
                print(f"  {'✅' if pat in html else '—'} {name}: {html.count(pat)}")

            # عينة من أول منطقة ستوري لو موجودة
            for anchor in ('"post_id"', '"__typename":"Story"', '"creation_time"'):
                i = html.find(anchor)
                if i > -1:
                    sample = html[max(0, i - 400): i + 1200]
                    print(f"\n📌 عينة حوالين {anchor}:\n{sample[:1600]}")
                    break
            # كلمة محتاج في الـHTML
            print("منشورات فيها «محتاج»:", len(re.findall(r"محتاج", html)))
        except Exception as e:
            print("❌ فشل:", str(e)[:200])


@app.local_entrypoint()
def main() -> None:
    diag.remote()
