# MaintainEX Environment Variables Audit

## Server Variables

| Variable | Required | Default | Used By | Risk |
|---|---|---|---|---|
| `DATABASE_URL` | Yes | Local SQLite | Prisma | HIGH — contains password |
| `NEXTAUTH_SECRET` | Yes | None | JWT, HMAC, mobile auth | HIGH — shared secret |
| `NEXTAUTH_URL` | Yes | None | NextAuth | MEDIUM — production URL |
| `JWT_SECRET` | No | `NEXTAUTH_SECRET` | Admin JWT | MEDIUM — falls back to NEXTAUTH |
| `JWT_REFRESH_SECRET` | No | `NEXTAUTH_SECRET` | Admin refresh tokens | MEDIUM — falls back to NEXTAUTH |
| `PASSWORD_PEPPER` | Yes | None | Password hashing | HIGH — peppered hashes |
| `CLOUDINARY_CLOUD_NAME` | Yes | None | File uploads | LOW |
| `CLOUDINARY_API_KEY` | Yes | None | File uploads | LOW |
| `CLOUDINARY_API_SECRET` | Yes | None | File uploads | LOW |
| `CRON_SECRET` | Yes | None | Cron job auth | LOW — bearer token |
| `NODE_ENV` | No | `development` | Conditional logic | LOW |

## Mobile Variables

| Variable | Required | Default | Used By | Risk |
|---|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | Yes | None | API base URL | MEDIUM |
| `EXPO_PUBLIC_SOCKET_URL` | Yes | None | WebSocket URL | LOW |

## VPS Production Values

| Variable | Value | Status |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:maintainex_db_2025@dokploy-postgres...` | Known-good |
| `NEXTAUTH_SECRET` | `11c0f0358d35bf00cf0494186a158abeb4b9997afc53ca352cffcf086c54fd8a` | Known-good |
| `NEXTAUTH_URL` | `https://maintainex.lk` | Known-good |
| `JWT_SECRET` | `2142a1e2f0b63c6464cd5cb4b3a2d3d3` | Known-good |
| `JWT_REFRESH_SECRET` | `3e1e16d37c150c5e9347cd0e4748ee80` | Known-good |
| `PASSWORD_PEPPER` | `3f076c47424a3b2c7d61b058f6942c4f` | Known-good |
| `CRON_SECRET` | `maintainex-cron-secure-key-2025` | Known-good |
| `NODE_ENV` | `production` | Set |
| `CLOUDINARY_*` | Set | Set |
| `EXPO_PUBLIC_API_URL` | `https://maintainex.lk` | Set |
| `EXPO_PUBLIC_SOCKET_URL` | `wss://maintainex.lk` | Set |

## Security Concerns

1. **NEXTAUTH_SECRET shared** across mobile JWT + admin HMAC — compromising one compromises both
2. **JWT_SECRET falls back to NEXTAUTH_SECRET** — in many routes, if JWT_SECRET is not set, it uses NEXTAUTH_SECRET
3. **PASSWORD_PEPPER in env** — if env is compromised, all peppered hashes are vulnerable
4. **Dokploy stores wrong DB password** — known issue, need to fix in Dokploy dashboard
5. **No `.env.example`** — new developers don't know required variables
6. **CRON_SECRET is a simple string** — not a strong secret
