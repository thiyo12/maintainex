# MaintainEX CI/CD Audit

## Current State

| Aspect | Status |
|---|---|
| CI/CD Pipeline | **NONE** |
| GitHub Actions | **NONE** |
| Pre-commit hooks | **NONE** |
| Lint check | Manual (`npm run lint`) |
| Type check | Manual (`npx tsc --noEmit`) |
| Test runner | Manual (`npx vitest run`) |
| Build verification | Manual (`npm run build`) |
| Deployment | Manual (Docker build + push) |
| Rollback | Manual (Dokploy dashboard) |

## Available Scripts

| Script | Command | Status |
|---|---|---|
| `npm run lint` | `next lint` | Works — only warns on `@next/next/no-img-element` |
| `npx tsc --noEmit` | TypeScript check | Works |
| `npx vitest run` | Run tests | Works (54 test files) |
| `npm run build` | `npx prisma generate && next build` | Works |
| `npm test` | **NOT DEFINED** | Missing |

## Docker Build

```dockerfile
# 3-stage build
FROM node:20-slim AS base
FROM base AS deps (npm ci)
FROM deps AS builder (sed sqlite→postgresql, prisma generate, next build)
FROM builder AS runner (copy output, set node_modules=.prisma/client)
```

**Production CMD:** ~~`npx prisma db push && npm start`~~ `npx prisma migrate deploy && npm start` (**RESOLVED**)

## Deployment Methods

| Method | When | Process |
|---|---|---|
| Dokploy auto-deploy | Git push to main | Nixpacks build → deploy |
| Docker manual | VPS update | `docker build` → `docker push` → Dokploy activate |
| Vercel | Web only | Git push → auto deploy |

## Recommended CI/CD Pipeline

```yaml
# .github/workflows/ci.yml (TO BE CREATED)
name: CI
on: [push, pull_request]
jobs:
  lint:
    - npm run lint
  typecheck:
    - npx tsc --noEmit
  test:
    - npx vitest run
  build:
    - npm run build
```

## Recommendations

1. Add `npm test` script to package.json
2. Create GitHub Actions workflow for lint + typecheck + test + build
3. Add pre-commit hooks (husky + lint-staged)
4. Add PR gate (require CI pass before merge)
5. Add deployment automation (Vercel for web, EAS for mobile)
