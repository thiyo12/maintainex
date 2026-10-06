FROM node:20-slim AS installer
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl build-essential python3 && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --ignore-scripts

FROM node:20-slim AS builder
WORKDIR /app
# Release provenance (fail closed): the build pipeline MUST pass
# --build-arg GIT_SHA=<full 40-char commit>. Anything else aborts the build,
# so an image can never ship without a valid baked release identity
# (see scripts/require-release-sha.sh and scripts/start-production.sh).
ARG GIT_SHA
RUN if ! printf '%s' "${GIT_SHA:-}" | grep -Eq '^[0-9a-f]{40}$'; then echo "ERROR: GIT_SHA build arg must be exactly 40 lowercase hex characters (full commit SHA)" >&2; exit 1; fi
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=installer /app/node_modules ./node_modules
COPY . .
RUN printf '%s' "$GIT_SHA" > /app/.release-sha
RUN npx prisma generate && mkdir -p public/uploads/services && chmod 755 public/uploads/services
RUN npm run build

FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl curl && rm -rf /var/lib/apt/lists/*
RUN groupadd --gid 1001 appgroup && useradd --uid 1001 --gid appgroup --shell /bin/sh --create-home appuser
COPY --from=installer /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts/bootstrap-payment-providers.cjs ./scripts/bootstrap-payment-providers.cjs
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/.release-sha ./.release-sha
COPY --from=builder /app/scripts/start-production.sh ./scripts/start-production.sh
COPY --from=builder /app/scripts/require-release-sha.sh ./scripts/require-release-sha.sh
RUN chown -R appuser:appgroup /app && chmod +x /app/scripts/start-production.sh
USER appuser
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
CMD ["sh", "/app/scripts/start-production.sh"]
