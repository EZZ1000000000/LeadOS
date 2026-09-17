#!/usr/bin/env python3
"""رفع وثيقة LeadOS كـGitHub Gist عام — ينتج لينك تحميل يشتغل من أي جهاز."""
import json
import sys
import urllib.request
from pathlib import Path

DOC = Path("/home/z/my-project/download/LeadOS-System-Documentation.md")
TOKEN_FILE = Path("/home/z/my-project/upload/api من جيت هاب.txt")


def main() -> int:
    token = TOKEN_FILE.read_text(encoding="utf-8").strip().splitlines()[0].strip()
    content = DOC.read_text(encoding="utf-8")

    payload = {
        "description": "LeadOS — وثيقة النظام الكاملة (منصة الصيد + كيان زيزو للبيع الذاتي)",
        "public": True,
        "files": {"LeadOS-System-Documentation.md": {"content": content}},
    }

    req = urllib.request.Request(
        "https://api.github.com/gists",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "leados-doc-uploader",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=30) as res:
        data = json.loads(res.read().decode("utf-8"))

    gist_id = data.get("id", "?")
    html = data.get("html_url", "?")
    raw = data.get("files", {}).get("LeadOS-System-Documentation.md", {}).get("raw_url", "?")
    print(f"gist_id: {gist_id}")
    print(f"html_url: {html}")
    print(f"raw_url: {raw}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
