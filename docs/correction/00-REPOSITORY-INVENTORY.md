# MaintainEX Repository Inventory

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Web Framework | Next.js (App Router) | 14.2.25 |
| React (web) | React | ^18.3.1 |
| Mobile Framework | Expo | ^56.0.12 |
| React Native | React Native | 0.85.3 |
| React (mobile) | React | 19.2.3 |
| Language | TypeScript | ^5.4.5 (web) / ~6.0.3 (mobile) |
| ORM | Prisma | ^5.14.0 |
| Database (dev) | SQLite | via Prisma |
| Database (prod) | PostgreSQL | via Docker |
| CSS | Tailwind CSS | ^3.4.3 |
| UI Kit | shadcn/ui (base-nova) | ^4.11.0 |
| State Management | Zustand | ^5.0.14 |
| Data Fetching | TanStack React Query | ^5.101.0 |
| Forms | React Hook Form + Zod | ^7.78.0 / ^3.23.8 |
| Auth | JWT (custom), bcryptjs, otplib | - |
| Testing | Vitest | ^4.1.8 |
| Linting | ESLint (next/core-web-vitals) | ^8.57.0 |
| Build/Deploy | Docker (node:20-slim), Vercel, Dokploy/Nixpacks | - |
| Package Manager | npm | - |
| Total Source Files | ~600 (316 .ts + 285 .tsx + others) | - |
| Prisma Models | 122 | - |
| API Routes | ~192 route files | - |

## Repository Structure

- **Root** — Next.js web app (App Router at `app/`)
- **`apps/mobile/`** — Expo React Native app (file-based routing)
- **No monorepo tooling** — Semi-monorepo with independent package.json files

## Key Configuration Files

| File | Purpose |
|---|---|
| `package.json` | Root dependencies, scripts |
| `apps/mobile/package.json` | Mobile dependencies |
| `tsconfig.json` | Web TypeScript config (strict) |
| `apps/mobile/tsconfig.json` | Mobile TypeScript config (strict) |
| `next.config.js` | Next.js config, security headers, redirects |
| `apps/mobile/app.json` | Expo config, plugins, bundle ID |
| `tailwind.config.ts` | Dark mode, custom colors, Outfit font |
| `vitest.config.mts` | Test config (node env, globals) |
| `.eslintrc.json` | ESLint config |
| `postcss.config.js` | PostCSS with Tailwind |
| `components.json` | shadcn/ui config |
| `Dockerfile` | 3-stage Docker build |
| `nixpacks.toml` | Dokploy/Nixpacks config |
| `vercel.json` | Vercel cron schedules |

## Scripts (Root package.json)

| Script | Command |
|---|---|
| `dev` | `next dev` |
| `dev:mobile` | `cd apps/mobile && npx expo start` |
| `build` | `npx prisma generate && next build` |
| `start` | `next start` |
| `lint` | `next lint` |
| `db:generate` | `prisma generate` |
| `db:push:dev` | `prisma db push` (DEVELOPMENT ONLY) |
| `db:migrate` | `prisma migrate dev` |
| `db:seed` | `ts-node --tsconfig tsconfig.json prisma/seed.ts` |
| `postinstall` | `npx prisma generate` |
