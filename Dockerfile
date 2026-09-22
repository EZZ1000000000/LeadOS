# LeadOS — صورة إنتاج موحدة (VPS / Railway / Fly / أي Docker host)
# المرحلة 1: البناء
FROM node:22-bookworm-slim AS builder
RUN apt-get update -y && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}" \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# نسخ ملفات التبعيات أولاً (كاش طبقات أسرع)
COPY package.json bun.lock ./
RUN bun install

# نسخ الباقي والبناء
COPY . .
RUN bunx prisma generate \
    && bun run build

# المرحلة 2: التشغيل — خادم + supervisor + النبضة + الباك أبوط جوا حاوية واحدة
FROM node:22-bookworm-slim AS runtime
RUN apt-get update -y && apt-get install -y --no-install-recommends curl ca-certificates sqlite3 \
    && curl -fsSL https://bun.sh/install | bash \
    && rm -rf /var/lib/apt/lists/*
ENV PATH="/root/.bun/bin:${PATH}" \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL="file:/app/db/custom.db"
WORKDIR /app

COPY --from=builder /app/.next/standalone ./.next/standalone
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/db ./db
COPY --from=builder /app/package.json ./package.json
# Caddyfile لو هيستخدم جوا الحاوية (اختياري)
COPY Caddyfile.deploy* ./

EXPOSE 3000
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -sf http://localhost:3000/ || exit 1

# entrypoint بيشغّل: supervisor (خادم+نبضة+باك أب ذاتي الإصلاح) + الباك أب الخارجي
COPY scripts/deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
