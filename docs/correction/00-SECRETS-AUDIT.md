# MaintainEX Secrets Audit

## Security notice

Production secret values must never be stored in Git, documentation, source code, examples, issues, pull requests, build logs, or screenshots.

This repository intentionally contains only variable names and risk classifications. Production values are stored only in the deployment environment / secret manager.

## Environment Variables (Server)

| Variable | Required | Risk |
|---|---|---|
| `DATABASE_URL` | Yes | HIGH — contains database credentials |
| `NEXTAUTH_SECRET` | Legacy/compatibility | HIGH — authentication secret |
| `JWT_SECRET` | Legacy/compatibility | HIGH — authentication secret |
| `JWT_REFRESH_SECRET` | Legacy/compatibility | HIGH — refresh-token secret |
| `MARKETPLACE_JWT_SECRET` | Yes | HIGH — marketplace token signing |
| `STAFF_JWT_SECRET` | Yes | HIGH — staff token signing |
| `PASSWORD_PEPPER` | Yes | HIGH — password hashing pepper |
| `CRON_SECRET` | Yes | HIGH — machine authentication |
| `INTERNAL_SYNC_SECRET` | Yes | HIGH — internal machine authentication |
| `CLOUDINARY_CLOUD_NAME` | As configured | LOW |
| `CLOUDINARY_API_KEY` | As configured | MEDIUM |
| `CLOUDINARY_API_SECRET` | As configured | HIGH |
| `NEXTAUTH_URL` | Yes | LOW — public URL |
| `NODE_ENV` | No | LOW |

## Environment Variables (Mobile)

| Variable | Required | Risk |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Yes | LOW — public API base URL |
| `EXPO_PUBLIC_SOCKET_URL` | As configured | LOW — public WebSocket URL |

## Rules

1. Never commit real secret values.
2. Use generated placeholders in `.env.example`.
3. Store production secrets only in Dokploy/VPS environment configuration or an approved secret manager.
4. Rotate any secret that is ever exposed publicly.
5. Authentication secrets must be independent from one another.
6. Keep production database credentials out of documentation and scripts.
