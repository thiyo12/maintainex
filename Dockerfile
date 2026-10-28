FROM node:20-slim AS installer
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl build-essential python3 && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --ignore-scripts

FROM node:20-slim AS builder
WORKDIR /app
# Release provenance: CI/deploy pipelines may pass the full SHA explicitly.
# Dokploy's standard builder may omit build arguments; derive the checkout SHA
# from the Git metadata file in the context in that case.
ARG GIT_SHA
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=installer /app/node_modules ./node_modules
COPY . .
RUN if ! printf '%s' "${GIT_SHA:-}" | grep -Eq '^[0-9a-f]{40}$'; then \
      GIT_SHA="$(node -e 'const fs=require("fs");const h=fs.readFileSync(".git/HEAD","utf8").trim();if(h.startsWith("ref: ")){const r=h.slice(5);if(fs.existsSync(`.git/${r}`))process.stdout.write(fs.readFileSync(`.git/${r}`,"utf8").trim());else{const p=fs.readFileSync(".git/packed-refs","utf8").split("\n").find(x=>x.endsWith(` ${r}`));if(p)process.stdout.write(p.split(" ")[0]);}}else process.stdout.write(h);' 2>/dev/null || true)"; \
    fi && \
    if ! printf '%s' "${GIT_SHA:-}" | grep -Eq '^[0-9a-f]{40}$'; then \
      echo "ERROR: could not determine full Git commit SHA from build arg or .git" >&2; exit 1; \
    fi && printf '%s' "$GIT_SHA" > /app/.release-sha
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
