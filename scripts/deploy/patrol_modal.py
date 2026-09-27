# LeadOS — نبضة 24/7 على المودال (بديل Vercel Cron)
# deployment: python3 -m modal deploy scripts/deploy/patrol_modal.py
# نبضة يدوية: python3 -m modal run scripts/deploy/patrol_modal.py::patrol
#
# السر (Modal Secret اسمه "leados") لازم يكون فيه على الأقل:
#   DATABASE_URL (Neon pooled) — FACEBOOK_SESSION_COOKIE — APIFY_TOKENS — CRON_SECRET
# وباقي المفاتيح الاختيارية بتتقرا لو موجودة (SERPER_API_KEY, TAVILY_API_KEY, GEMINI_API_KEY...)

import modal

app = modal.App("leados-patrol")

# مفاتيح البيئة اللي النبضة ممكن تحتاجها — الموجود منها بس هو اللي بينزل للكونتينة
SECRET_KEYS = [
    "DATABASE_URL",
    "DIRECT_URL",
    "CRON_SECRET",
    "AUTH_SECRET",
    "FACEBOOK_SESSION_COOKIE",
    "APIFY_TOKEN",
    "APIFY_TOKENS",
    "SERPER_API_KEY",
    "TAVILY_API_KEY",
    "SERPAPI_API_KEY",
    "EXA_API_KEY",
    "GEMINI_API_KEY",
    "GROQ_API_KEY",
    "MISTRAL_API_KEY",
    "OPENROUTER_API_KEY",
    "WHATSAPP_NUMBER",
    "ZIZO_WHATSAPP",
    "ZIZO_TELEGRAM",
]

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("curl", "unzip", "ca-certificates")
    .run_commands(
        # bun: مشغل سكربتات TS بسرعة بدون build خطوة إضافية
        "curl -fsSL https://bun.sh/install | bash -s bun-v1.1.34",
        "mv /root/.bun/bin/bun /usr/local/bin/bun",
    )
    .pip_install("httpx")
    .add_local_dir(
        "/home/z/my-project",
        "/root/app",
        condition=lambda path: "node_modules" not in path and ".next" not in path and "db/" not in path,
    )
    .run_commands("cd /root/app && bun install --production")
)

MINUTES_15 = 60 * 15


@app.function(
    image=image,
    schedule=modal.Period(minutes=15),
    timeout=320,  # النبضة لازم تخلص جوه 5 دقايق ونص — بعدها الجوب التالي يكمل الشغل
    secrets=[modal.Secret.from_name("leados")],
    scaledown_window=60,
)
def patrol() -> None:
    import subprocess

    r = subprocess.run(
        ["bun", "run", "scripts/modal-pulse.ts"],
        cwd="/root/app",
        capture_output=True,
        text=True,
        timeout=300,
    )
    print(r.stdout[-4000:])
    if r.returncode != 0:
        print("PULSE FAILED:", r.stderr[-2000:])
        raise RuntimeError(r.stderr[-500:])


@app.local_entrypoint()
def main() -> None:
    # python3 -m modal run scripts/deploy/patrol_modal.py::patrol → نبضة فورية
    patrol.remote()
