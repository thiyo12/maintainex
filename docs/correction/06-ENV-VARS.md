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

## Production Configuration

Production values must be stored only in the deployment platform / secret manager and must never be committed to Git.

| Variable | Repository value |
|---|---|
| `DATABASE_URL` | `postgresql://USER:PASSWORD@HOST:5432/DATABASE` (placeholder only) |
| `NEXTAUTH_SECRET` | `<generate-and-store-outside-git>` |
| `JWT_SECRET` | `<generate-and-store-outside-git>` |
| `JWT_REFRESH_SECRET` | `<generate-and-store-outside-git>` |
| `PASSWORD_PEPPER` | `<generate-and-store-outside-git>` |
| `CRON_SECRET` | `<generate-and-store-outside-git>` |
| `CLOUDINARY_API_SECRET` | `<store-outside-git>` |
| `SMTP_APP_PASSWORD` | `<store-outside-git>` |
| `PAYHERE_MERCHANT_SECRET` | `<store-outside-git>` |

## Security Concerns

1. **NEXTAUTH_SECRET shared** across mobile JWT + admin HMAC — compromising one compromises both
2. **JWT_SECRET falls back to NEXTAUTH_SECRET** — in many routes, if JWT_SECRET is not set, it uses NEXTAUTH_SECRET
3. **PASSWORD_PEPPER in env** — if env is compromised, all peppered hashes are vulnerable
4. **Dokploy stores wrong DB password** — known issue, need to fix in Dokploy dashboard
5. **No `.env.example`** — new developers don't know required variables
6. **CRON_SECRET is a simple string** — not a strong secret
