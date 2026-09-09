# MaintainEX Security Infrastructure

## Middleware (middleware.ts)

| Aspect | Value |
|---|---|
| Runs on | `/api/*`, `/admin/*`, `/setup/*` |
| Auth verifier | Inline `verifyAdminSession()` using Web Crypto API |
| Rate limiting | In-memory Map (not distributed-safe) |
| IP blocking | In-memory Set synced from DB every 60s |
| CORS | `lib/cors.ts` (buggy) |
| Security headers | Applied via `next.config.js` + API route overrides |

## CORS Configuration

**File:** `lib/cors.ts`

```typescript
const ALLOWED_ORIGINS = ['http://localhost:8081', 'https://maintainex.lk']
// BUG: Wildcard check overwrites intent
if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
  headers.set('Access-Control-Allow-Origin', '*')  // Always public
}
```

**Impact:** Mobile API is fully public regardless of intent.

## Security Headers

| Header | Value | Issue |
|---|---|---|
| CSP | `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'` | Weakens CSP |
| X-Content-Type-Options | `nosniff` | Good |
| X-Frame-Options | `DENY` | Good |
| X-XSS-Protection | `1; mode=block` | Good |
| Referrer-Policy | `strict-origin-when-cross-origin` | Good |
| HSTS | `max-age=31536000; includeSubDomains; preload` | Good |
| X-Powered-By | `Next.js` | Info leak |

## Rate Limiting

| Layer | Storage | Distributed? |
|---|---|---|
| `middleware.ts` default | In-memory Map | No |
| `middleware.ts` auth | In-memory Map | No |
| `lib/rate-limit.ts` | PostgreSQL | Yes |
| OTP limit | PostgreSQL | Yes |

## Admin Auth (middleware.ts)

```typescript
// Independent from lib/admin-auth.ts
// Uses Web Crypto API (crypto.subtle) instead of jsonwebtoken
// Does not check AdminSession.isRevoked
```

## Recommendations

1. Fix CORS wildcard bug in `lib/cors.ts`
2. Add origin validation to admin CORS
3. Unify middleware auth with `lib/admin-auth.ts`
4. Add `Prisma.idempotencyKey` or `SELECT FOR UPDATE` to financial mutations
5. Add `UniqueConstraintViolation` handling
