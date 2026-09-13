"""
تحويل ملفات الكوكيز المصدّرة من المتصفح إلى worker/state/<platform>_cookies.json
- يصلح JSON المكسور (مثل ملف انستجرام اللي سقطت منه علامات التنصيص)
- يوحد الصيغة لقائمة كوكيز قياسية (name/value/domain/path/secure/httpOnly/expires)
- يتحقق من وجود كوكيز الجلسة الحرجة لكل منصة
"""
import json
import re
import sys
from pathlib import Path

UPLOAD = Path("/home/z/my-project/upload")
STATE = Path("/home/z/my-project/worker/state")
STATE.mkdir(exist_ok=True)

PLATFORMS = {
    "فيسبوك": ("facebook", ["c_user", "xs", "datr"]),
    "انستجرام": ("instagram", ["sessionid", "ds_user_id", "datr"]),
    "x تويتر": ("x", ["auth_token", "ct0"]),
    "لينكد ان": ("linkedin", ["li_at", "liap"]),
    "ريدت": ("reddit", ["token_v2", "reddit_session"]),
}

SESSION_HINTS = {
    "facebook": ["c_user", "xs"],
    "instagram": ["sessionid", "ds_user_id"],
    "x": ["auth_token", "ct0"],
    "linkedin": ["li_at"],
    "reddit": ["token_v2", "reddit_session"],
}


def repair_loose_json(text: str) -> str:
    """يصلح JSON اللي طاحت منه علامات التنصيص: `domain .instagram.com,` → `"domain": ".instagram.com",`"""
    out = []
    for line in text.splitlines():
        s = line.rstrip()
        if not s or s.strip() in ("{", "}", "[", "]", "},", "],"):
            out.append(s)
            continue
        # مفتاح بلا تنصيص: <key> <value>,
        m = re.match(r'^\s*([A-Za-z_][A-Za-z0-9_\-]+)\s+(null|true|false)\s*,?\s*$', s)
        if m:
            indent = s[:len(s) - len(s.lstrip())]
            comma = "," if s.rstrip().endswith(",") else ""
            out.append(f'{indent}"{m.group(1)}": {m.group(2)}{comma}')
            continue
        m = re.match(r'^\s*([A-Za-z_][A-Za-z0-9_\-]+)\s+(.*?)\s*,?\s*$', s)
        if m:
            key, raw = m.group(1), m.group(2)
            indent = s[:len(s) - len(s.lstrip())]
            comma = "," if s.rstrip().endswith(",") else ""
            val = raw
            if not re.match(r'^-?\d+(\.\d+)?$', val) and val not in ("true", "false", "null"):
                # قيمة نصية — اقتبسها (مع تعشيش أي تنصيص داخلي)
                val = '"' + val.replace('\\', '\\\\').replace('"', '\\"') + '"'
            out.append(f'{indent}"{key}": {val}{comma}')
            continue
        out.append(s)
    return "\n".join(out)


def parse_cookies(path: Path):
    text = path.read_text(encoding="utf-8", errors="replace")
    try:
        data = json.loads(text)
        fmt = "json سليم"
    except json.JSONDecodeError:
        try:
            data = json.loads(repair_loose_json(text))
            fmt = "json مُصلح"
        except json.JSONDecodeError as e:
            return None, f"فشل حتى بعد الإصلاح: {str(e)[:80]}"
    if not isinstance(data, list):
        return None, "الملف مش قائمة كوكيز"
    cookies = []
    for c in data:
        if not isinstance(c, dict):
            continue
        name, value = c.get("name"), c.get("value")
        if not name or value is None:
            continue
        expires = c.get("expirationDate") or c.get("expires") or c.get("expiry")
        std = {
            "name": str(name),
            "value": str(value),
            "domain": str(c.get("domain") or ""),
            "path": str(c.get("path") or "/"),
            "secure": bool(c.get("secure", False)),
            "httpOnly": bool(c.get("httpOnly", False)),
        }
        if isinstance(expires, (int, float)):
            std["expires"] = int(expires)
        cookies.append(std)
    return cookies, fmt


def main():
    print(f"{'المنصة':<12} {'الملف':<14} {'كوكيز':>6}  جلسة؟  ملاحظة")
    print("-" * 62)
    ok_any = True
    for src_name, (platform, _) in PLATFORMS.items():
        src = UPLOAD / src_name
        if not src.exists():
            print(f"{platform:<12} {'—':<14}      0  ❌     الملف مش موجود")
            ok_any = False
            continue
        cookies, note = parse_cookies(src)
        if cookies is None:
            print(f"{platform:<12} {src_name[:12]:<14}      0  ❌     {note}")
            ok_any = False
            continue
        names = {c["name"] for c in cookies}
        session_ok = any(h in names for h in SESSION_HINTS[platform])
        # حفظ
        out = STATE / f"{platform}_cookies.json"
        out.write_text(json.dumps(cookies, ensure_ascii=False, indent=2), encoding="utf-8")
        mark = "✅" if session_ok else "⚠️"
        print(f"{platform:<12} {src_name[:12]:<14} {len(cookies):>6}  {mark}     {note}")
        # تفاصيل كوكيز الجلسة المهمة
        for h in SESSION_HINTS[platform]:
            if h in names:
                c = next(c for c in cookies if c["name"] == h)
                print(f"{'':>26}↳ {h} (ينتهي: {c.get('expires', 'جلسة')})")
    print()
    if ok_any:
        print("✅ كل الملفات اتحولت لـ worker/state/")
    else:
        print("⚠️ في ملفات ناقصة/فاشلة — راجع الأعلى")
    return 0 if ok_any else 1


if __name__ == "__main__":
    sys.exit(main())
