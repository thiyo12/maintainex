FROM node:20-slim AS installer
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl build-essential python3 && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --ignore-scripts

FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=installer /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && mkdir -p public/uploads/services && chmod 755 public/uploads/services
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=installer /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"
CMD npx prisma migrate deploy && npm start
