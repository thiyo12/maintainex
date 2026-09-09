# MaintainEX Build Baseline

## Build System

| Component | Tool | Command |
|---|---|---|
| Web build | Next.js | `npx prisma generate && next build` |
| Mobile build | Expo | `npx expo export` |
| Docker build | Docker | 3-stage Dockerfile |
| Prisma generate | Prisma | `npx prisma generate` |
| Type check | TypeScript | `npx tsc --noEmit` |
| Lint | ESLint | `next lint` |
| Test | Vitest | `npx vitest run` |

## Docker Build Stages

```dockerfile
# Stage 1: Base
FROM node:20-slim AS base

# Stage 2: Dependencies
FROM base AS deps
COPY package*.json ./
RUN npm ci

# Stage 3: Builder
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
RUN npx prisma generate
RUN npm run build

# Stage 4: Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
CMD npx prisma migrate deploy && npm start
```

## Build Outputs

| Output | Location | Size |
|---|---|---|
| Next.js standalone | `.next/standalone` | ~150MB |
| Next.js static | `.next/static` | ~5MB |
| Docker image | `maintainex-mx-vcaohy:prod-slim7` | ~200MB |
| Mobile bundle | `dist/` (Expo export) | ~50MB |

## Known Build Issues

1. **sed hack in Dockerfile** — `sed -i 's/provider = "sqlite"/provider = "postgresql"/'` breaks if line format changes
2. **No `npm test` script** — Tests must be run manually via `npx vitest run`
3. **Postinstall runs `prisma generate`** — Can fail if schema is invalid
4. **Mobile build requires EAS** — Not configured for CI/CD

## Build Verification

```bash
# Web
npm run lint && npx tsc --noEmit && npm run build

# Mobile
cd apps/mobile && npx expo export

# Docker
docker build -t maintainex .
```
