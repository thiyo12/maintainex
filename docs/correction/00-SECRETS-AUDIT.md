# MaintainEX Secrets Audit

## Environment Variables (Server)

| Variable | Required | Default | Risk |
|---|---|---|---|
| `DATABASE_URL` | Yes | Local SQLite | HIGH — contains password |
| `NEXTAUTH_SECRET` | Yes | None | HIGH — shared across mobile JWT + admin HMAC |
| `NEXTAUTH_URL` | Yes | None | MEDIUM |
| `JWT_SECRET` | No | Falls back to `NEXTAUTH_SECRET` | MEDIUM |
| `JWT_REFRESH_SECRET` | No | Falls back to `NEXTAUTH_SECRET` | MEDIUM |
| `PASSWORD_PEPPER` | Yes | None | HIGH — peppered hashes |
| `CLOUDINARY_CLOUD_NAME` | Yes | None | LOW |
| `CLOUDINARY_API_KEY` | Yes | None | LOW |
| `CLOUDINARY_API_SECRET` | Yes | None | LOW |
| `CRON_SECRET` | Yes | None | LOW — simple string |
| `NODE_ENV` | No | `development` | LOW |

## Environment Variables (Mobile)

| Variable | Required | Risk |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Yes | MEDIUM — API base URL |
| `EXPO_PUBLIC_SOCKET_URL` | Yes | LOW — WebSocket URL |

## Shared Secret Problem

`NEXTAUTH_SECRET` is used by:
1. Mobile JWT (`lib/mobile-auth.ts`) — 30-day tokens
2. Admin legacy HMAC (`lib/auth-utils.ts`) — 30-day tokens
3. Admin new JWT fallback (`lib/admin-auth.ts`) — when `JWT_SECRET` not set
4. Middleware inline verifier (`middleware.ts`) — Web Crypto API

**Impact:** Compromising `NEXTAUTH_SECRET` compromises all three auth systems.

## VPS Production Values

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:maintainex_db_2025@dokploy-postgres...` |
| `NEXTAUTH_SECRET` | `11c0f0358d35bf00cf0494186a158abeb4b9997afc53ca352cffcf086c54fd8a` |
| `NEXTAUTH_URL` | `https://maintainex.lk` |
| `JWT_SECRET` | `2142a1e2f0b63c6464cd5cb4b3a2d3d3` |
| `JWT_REFRESH_SECRET` | `3e1e16d37c150c5e9347cd0e4748ee80` |
| `PASSWORD_PEPPER` | `3f076c47424a3b2c7d61b058f6942c4f` |
| `CRON_SECRET` | `maintainex-cron-secure-key-2025` |
| `CLOUDINARY_*` | Set |
| `EXPO_PUBLIC_API_URL` | `https://maintainex.lk` |
| `EXPO_PUBLIC_SOCKET_URL` | `wss://maintainex.lk` |

## Recommendations

1. Separate `NEXTAUTH_SECRET` into dedicated secrets per system
2. Strengthen `CRON_SECRET` (current value is weak)
3. Add `.env.example` for developer onboarding
4. Rotate secrets periodically
5. Never commit secrets to repository
