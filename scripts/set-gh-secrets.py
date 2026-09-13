#!/usr/bin/env python3
"""Set GitHub Actions repo secrets: CRON_SECRET + LEADOS_BASE_URL (for cron-tick.yml)."""
import base64
import json
import sys
import urllib.request
from pathlib import Path
from nacl import encoding, public

REPO = "EZZ1000000000/LeadOS"
TOKEN = Path("/tmp/gh_token").read_text().strip()


def api(url: str, method: str = "GET", payload: dict | None = None):
    req = urllib.request.Request(
        f"https://api.github.com{url}",
        method=method,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Accept": "application/vnd.github+json",
        },
        data=json.dumps(payload).encode() if payload else None,
    )
    with urllib.request.urlopen(req) as res:
        body = res.read()
        return json.loads(body) if body else {}


def set_secret(name: str, value: str) -> None:
    key_info = api(f"/repos/{REPO}/actions/secrets/public-key")
    pk = public.PublicKey(key_info["key"].encode(), encoding.Base64Encoder())
    sealed = public.SealedBox(pk).encrypt(value.encode())
    api(
        f"/repos/{REPO}/actions/secrets/{name}",
        method="PUT",
        payload={"encrypted_value": base64.b64encode(sealed).decode(), "key_id": key_info["key_id"]},
    )
    print(f"secret set: {name}")


def read_env(key: str) -> str:
    for line in Path("/home/z/my-project/.env").read_text().splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip()
    raise KeyError(key)


set_secret("CRON_SECRET", read_env("CRON_SECRET"))
set_secret("LEADOS_BASE_URL", "https://leados-v2.vercel.app")
print("done")
