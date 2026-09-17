#!/usr/bin/env python3
# LeadOS — Camoufox Stealth Browser Sidecar
# متصفح Firefox مضاد للبصمة (fingerprint spoofing + uBlock) كخدمة HTTP محلية.
# الأيجنت/المونيتورز في Next.js يتكلموا معاه على http://127.0.0.1:9797
#
# نقاط النهاية:
#   GET  /health                       → {ok, browser, pages}
#   POST /navigate {url,...}           → تصفح + نص الصفحة + سكرين شوت اختياري
#   POST /act      {action,...}        → click/type/press/scroll/wait/eval/screenshot
#   POST /extract  {selector,...}      → استخراج نصوص/خصائص عناصر
#   POST /cookies  {cookies:[...]}     → حقن كوكيز (جلسات مسجلة) في البروفايل
#   POST /close    {session}           → غلق تاب
#   POST /shutdown                     → إيقاف الخدمة
#
# البروفايل دائم (persistent_context) — الكوكيز واللوجين بيفضلوا بعد الريستارت.
# الحماية: CAMOUFOX_TOKEN لو اتعيّر يُطلب في هيدر x-leados-token.

import base64
import json
import os
import queue
import sys
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("CAMOUFOX_PORT", "9797"))
BIND = os.environ.get("CAMOUFOX_BIND", "127.0.0.1")
TOKEN = os.environ.get("CAMOUFOX_TOKEN", "")
PROFILE = os.environ.get("CAMOUFOX_PROFILE", os.path.expanduser("~/.leados/camoufox-profile"))
MAX_TEXT = 80_000
# إغلاق تلقائي للمتصفح بعد فترة فاضي (يوفر ~800MB على الأجهزة الصغيرة) — 0 = معطّل
IDLE_SECS = int(os.environ.get("CAMOUFOX_IDLE_SECS", "300"))


# ─── عامل المتصفح: كل عمليات Playwright في ثريد واحد (متطلب الـsync API) ───
class BrowserWorker:
    def __init__(self):
        self.q: queue.Queue = queue.Queue()
        self.ctx = None
        self.cm = None
        self.pages = {}
        self.booting = False
        self.last_used = time.time()
        self.thread = threading.Thread(target=self._loop, daemon=True, name="camoufox")
        self.thread.start()

    def call(self, fn, *args, timeout: float = 300.0):
        box, done = {}, threading.Event()
        self.q.put((fn, args, box, done))
        if not done.wait(timeout=timeout):
            raise TimeoutError(f"انتهت مهلة العملية ({int(timeout)} ث)")
        if "err" in box:
            raise RuntimeError(str(box["err"]))
        return box.get("ret")

    def _loop(self):
        while True:
            fn, args, box, done = self.q.get()
            try:
                box["ret"] = fn(*args)
            except BaseException as e:  # noqa: BLE001
                box["err"] = f"{type(e).__name__}: {e}"
                traceback.print_exc()
            finally:
                done.set()

    # ── الإطلاق (مرة واحدة، بروفايل دائم) ──
    def _launch(self):
        if self.ctx is not None:
            return
        self.booting = True
        from camoufox.sync_api import Camoufox

        os.makedirs(PROFILE, exist_ok=True)
        base = dict(
            headless=True,
            humanize=True,
            persistent_context=True,
            user_data_dir=PROFILE,
            enable_cache=True,
            block_images=False,
            locale=["ar-EG", "en-US"],
            os=["windows"],
        )
        try:
            self.cm = Camoufox(**base)
            self.ctx = self.cm.__enter__()
        except BaseException as e:  # noqa: BLE001
            print(f"[camoufox] إطلاق كامل فشل ({e}) — محاولة مبسطة", file=sys.stderr)
            self.cm = Camoufox(headless=True, persistent_context=True, user_data_dir=PROFILE)
            self.ctx = self.cm.__enter__()
        self.booting = False
        print("[camoufox] المتصفح جاهز ✅", flush=True)

    def page(self, session="default"):
        self.last_used = time.time()
        self._launch()
        p = self.pages.get(session)
        if p is None or p.is_closed():
            p = self.ctx.new_page()
            p.set_default_timeout(30_000)
            self.pages[session] = p
        return p


W = BrowserWorker()


# ─── العمليات ───
def op_navigate(session, url, wait_until, timeout_ms, screenshot, full_page, scroll_times):
    p = W.page(session)
    resp = p.goto(url, wait_until=wait_until or "domcontentloaded", timeout=int(timeout_ms or 45_000))
    for _ in range(int(scroll_times or 0)):
        p.evaluate("window.scrollBy(0, Math.round(window.innerHeight * 2))")
        p.wait_for_timeout(1200)
    p.wait_for_timeout(400)
    text = p.evaluate("document.body ? document.body.innerText : ''") or ""
    shot = None
    if screenshot:
        shot = base64.b64encode(p.screenshot(full_page=bool(full_page))).decode()
    return {
        "ok": True,
        "url": p.url,
        "http_status": resp.status if resp else None,
        "title": p.title(),
        "text": text[:MAX_TEXT],
        "screenshot": shot,
    }


def op_act(session, action, selector, text, key, script, amount, timeout_ms):
    p = W.page(session)
    act = (action or "").lower()
    if act == "click":
        if not selector:
            raise ValueError("click يحتاج selector")
        p.click(selector, timeout=int(timeout_ms or 15_000))
        p.wait_for_timeout(600)
        return {"ok": True, "note": f"تم الضغط على {selector}"}
    if act == "type":
        if not selector or text is None:
            raise ValueError("type يحتاج selector + text")
        p.fill(selector, str(text), timeout=int(timeout_ms or 15_000))
        return {"ok": True, "note": "تم الكتابة"}
    if act == "press":
        if not key:
            raise ValueError("press يحتاج key")
        p.keyboard.press(str(key))
        return {"ok": True, "note": f"تم الضغط على {key}"}
    if act == "scroll":
        px = int(amount or 1200)
        p.evaluate(f"window.scrollBy(0, {px})")
        p.wait_for_timeout(500)
        return {"ok": True, "note": f"سكرول {px}px"}
    if act == "wait":
        p.wait_for_timeout(int(amount or 1000))
        return {"ok": True, "note": "انتظار"}
    if act == "eval":
        if not script:
            raise ValueError("eval يحتاج script")
        return {"ok": True, "result": p.evaluate(str(script))}
    if act == "screenshot":
        shot = base64.b64encode(p.screenshot(full_page=False)).decode()
        return {"ok": True, "screenshot": shot}
    raise ValueError(f"عملية غير معروفة: {action}")


def op_extract(session, selector, attr, limit):
    p = W.page(session)
    js = """([sel, attr, lim]) => Array.from(document.querySelectorAll(sel))
        .slice(0, lim)
        .map(e => attr === 'innerText'
            ? (e.innerText || e.textContent || '').trim()
            : (e.getAttribute(attr) || e.getAttribute('href') || ''))"""
    items = p.evaluate(js, [selector, attr or "innerText", int(limit or 50)])
    return {"ok": True, "count": len(items), "items": [i for i in items if i]}


def _norm_same_site(v):
    """توحيد sameSite لصيغة Playwright (Strict/Lax/None) — تصدير Cookie-Editor بييجي no_restriction/lax/strict"""
    s = str(v or "").strip().lower()
    if s in ("no_restriction", "none"):
        return "None"
    if s == "strict":
        return "Strict"
    return "Lax"  # lax + unspecified + فاضي


def op_add_cookies(cookies):
    """حقن كوكيز محافظًا على كل الخصائص — الكوكي من غير secure/sameSite فايرفوكس بيرفضه بصمت!
    (المشدد في Camoufox: strictSecureCookies — كوكي غير آمن على أصل https بيرمى)
    لذلك الافتراضي secure=True، وبيقبل expires أو expirationDate (تصدير الإضافات)."""
    W._launch()
    norm = []
    for c in cookies or []:
        if not c.get("name"):
            continue
        cc = {
            "name": c["name"],
            "value": c.get("value", ""),
            "domain": c.get("domain", ".facebook.com"),
            "path": c.get("path", "/"),
            "secure": bool(c.get("secure", True)),
            "httpOnly": bool(c.get("httpOnly", False)),
            "sameSite": _norm_same_site(c.get("sameSite")),
        }
        raw_exp = c.get("expires", c.get("expirationDate"))
        if raw_exp is not None:
            try:
                cc["expires"] = int(float(raw_exp))
            except (TypeError, ValueError):
                pass  # كوكي جلسة بدون انتهاء
        norm.append(cc)
    if norm:
        W.ctx.add_cookies(norm)
    return {"ok": True, "added": len(norm)}


def op_list_cookies(urls=None):
    """تشخيص: الجرة الحقيقية من Playwright (مش document.cookie) — القيم مختصرة"""
    W._launch()
    try:
        jar = W.ctx.cookies(urls) if urls else W.ctx.cookies()
    except BaseException as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)[:200]}
    slim = [
        {
            "name": c.get("name"),
            "domain": c.get("domain"),
            "path": c.get("path"),
            "secure": c.get("secure"),
            "httpOnly": c.get("httpOnly"),
            "sameSite": c.get("sameSite"),
            "expires": c.get("expires"),
            "value": str(c.get("value", ""))[:10],
        }
        for c in jar
    ]
    return {"ok": True, "count": len(slim), "cookies": slim}


def op_close(session):
    p = W.pages.pop(session, None)
    if p and not p.is_closed():
        p.close()
    return {"ok": True}


def op_shutdown():
    try:
        if W.cm:
            W.cm.__exit__(None, None, None)
    finally:
        os._exit(0)


def op_idle_check():
    """بتشتغل في ثريد العامل: لو المتصفح فاضي مدة أطول من IDLE_SECS يقفل ويحرر الذاكرة.
    الاستخدام الجاي هيعمل launch تلقائي (البروفايل دائم فالكوكيز بتفضل)."""
    if IDLE_SECS <= 0 or W.ctx is None:
        return {"closed": False}
    idle = time.time() - W.last_used
    if idle < IDLE_SECS:
        return {"closed": False, "idle_secs": int(idle)}
    try:
        if W.cm:
            W.cm.__exit__(None, None, None)
    except BaseException as e:  # noqa: BLE001
        print(f"[camoufox] إغلاق الفاضي بهدوء فشل: {e}", file=sys.stderr)
    W.ctx = None
    W.cm = None
    W.pages = {}
    print(f"[camoufox] المتصفح اتقفل بعد فاضي {int(idle)} ث (هيتفتح تلقائيًا عند الطلب) 💤", flush=True)
    return {"closed": True, "idle_secs": int(idle)}


def idle_watchdog():
    while True:
        time.sleep(30)
        if IDLE_SECS > 0:
            try:
                W.call(op_idle_check, timeout=60)
            except BaseException:  # noqa: BLE001
                pass


ROUTES = {
    "/navigate": lambda b: op_navigate(
        b.get("session", "default"), b.get("url"), b.get("wait_until"),
        b.get("timeout"), b.get("screenshot"), b.get("full_page"), b.get("scroll_times"),
    ),
    "/act": lambda b: op_act(
        b.get("session", "default"), b.get("action"), b.get("selector"), b.get("text"),
        b.get("key"), b.get("script"), b.get("amount"), b.get("timeout"),
    ),
    "/extract": lambda b: op_extract(
        b.get("session", "default"), b.get("selector"), b.get("attr"), b.get("limit"),
    ),
    "/cookies": lambda b: op_add_cookies(b.get("cookies")),
    "/jar": lambda b: op_list_cookies(b.get("urls")),
    "/close": lambda b: op_close(b.get("session", "default")),
    "/shutdown": lambda _b: op_shutdown(),
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # سجل هادئ
        print(f"[camoufox] {fmt % args}", flush=True)

    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authed(self):
        return not TOKEN or self.headers.get("x-leados-token") == TOKEN

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/jar":
            if not self._authed():
                return self._send(401, {"ok": False, "error": "unauthorized"})
            try:
                return self._send(200, W.call(op_list_cookies, None, timeout=60.0))
            except Exception as e:  # noqa: BLE001
                return self._send(500, {"ok": False, "error": str(e)[:300]})
        if path != "/health":
            return self._send(404, {"ok": False, "error": "not found"})
        if not self._authed():
            return self._send(401, {"ok": False, "error": "unauthorized"})
        return self._send(200, {
            "ok": True,
            "service": "leados-camoufox",
            "browser": "running" if W.ctx else ("booting" if W.booting else "idle"),
            "pages": len(W.pages),
            "profile": PROFILE,
        })

    def do_POST(self):
        path = self.path.split("?")[0]
        if path not in ROUTES:
            return self._send(404, {"ok": False, "error": "not found"})
        if not self._authed():
            return self._send(401, {"ok": False, "error": "unauthorized"})
        try:
            length = min(int(self.headers.get("Content-Length") or 0), 2_000_000)
            raw = self.rfile.read(length) if length else b"{}"
            body = json.loads(raw or b"{}")
        except Exception as e:  # noqa: BLE001
            return self._send(400, {"ok": False, "error": f"JSON غير صالح: {e}"})
        try:
            timeout = 300.0 if path == "/navigate" else 120.0
            return self._send(200, W.call(ROUTES[path], body, timeout=timeout))
        except Exception as e:  # noqa: BLE001
            return self._send(500, {"ok": False, "error": str(e)[:300]})


if __name__ == "__main__":
    srv = ThreadingHTTPServer((BIND, PORT), Handler)
    srv.daemon_threads = True
    threading.Thread(target=idle_watchdog, daemon=True, name="idle-watchdog").start()
    print(
        f"[camoufox] الخدمة شغالة على http://{BIND}:{PORT} — البروفايل: {PROFILE}"
        f" — إغلاق الفاضي بعد {IDLE_SECS}ث",
        flush=True,
    )
    srv.serve_forever()
