# LeadOS Worker — صورة Docker تعمل على VPS / Railway / Fly.io
FROM python:3.11-slim

# كروميوم + مكتبات التشغيل (بيئة رأس بلا واجهة)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium chromium-driver xvfb dbus-x11 fonts-noto-core fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Africa/Cairo

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY bot.py guard.py leados_client.py config.yaml ./

# مجلدات الحالة (الميزانيات + البروفايلات + الكوكيز)
RUN mkdir -p state profiles output

CMD ["python", "bot.py", "loop"]
