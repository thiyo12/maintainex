# MaintainEX Middleware & Security Audit

## Middleware Architecture

```typescript
// middleware.ts (INDEPENDENT from lib/admin-auth.ts)
export function middleware(request) {
  if (url.pathname.startsWith('/api/admin/')) {
    const adminSession = await verifyAdminSession(request)
    // Uses inline JWT verifier (Web Crypto API)
    // Does NOT use getAdminSession() from lib/admin-auth.ts
  }
}
```

### Two Independent Admin Auth Verifiers

| Location | Method | JWT Library | CORS |
|---|---|---|---|
| `middleware.ts` | `verifyAdminSession()` inline | Web Crypto API | Not applied |
| `lib/admin-auth.ts` | `getAdminSession()` | `jsonwebtoken` | `setCorsHeaders()` |

**Conflict:** Middleware allows/denies access, but the route's own auth may disagree. A request can be:
- Allowed by middleware, rejected by route (double lock-in)
- Blocked by middleware, never reaches route
- Route executes with different permissions than middleware assumed

## Security Headers

```typescript
// next.config.js securityHeaders
{
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' ...",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
}
```

**Issues:**
- `unsafe-inline` + `unsafe-eval` weakens CSP significantly
- `X-Powered-By: Next.js` header present (info leak)
- `Strict-Transport-Security` already added via API routes (conflicts with next.config.js)

## CORS Configuration

```typescript
// lib/cors.ts — MOBILE
const ALLOWED_ORIGINS = ['http://localhost:8081', 'https://maintainex.lk']
if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
  headers.set('Access-Control-Allow-Origin', '*')  // OVERWRITES permissive!
}
```

**Bug:** Wildcard check + hardcoded `*` means mobile API is fully public even when intent is restricted.

## Rate Limiting

| Layer | Storage | Distributed? | Bypass Risk |
|---|---|---|---|
| `middleware.ts` default | In-memory Map | No | High |
| `middleware.ts` auth | In-memory Map | No | High |
| `lib/rate-limit.ts` | PostgreSQL | Yes | Low |
| OTP limit | PostgreSQL (via OTP lib) | Yes | Low |

### X-Forwarded-For Spoofing
```typescript
const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
```
Without trusted proxy configuration, this is spoofable.

## Admin Route Security

| Pattern | Behavior |
|---|---|
| `/api/admin` or `/api/admin/*` | No auth at all (route-level) |
| `/api/admin/:entity` | Admin JWT only |
| `/api/admin/:entity/:id` | Admin JWT + role check |
| `/api/admin/staff/activity` | Admin + permissions + IP whitelist |
| `/api/admin/financial/*` | Admin + permissions |

### Admin CORS Headers
```typescript
headers.set('Access-Control-Allow-Origin', origin)
headers.set('Access-Control-Allow-Credentials', 'true')
```
No origin validation! Any origin gets credentials included.

## API Route Checklist

| Route | Auth | Ownership | Role Check | SQL Injection | Race Condition |
|---|---|---|---|---|---|
| POST /api/mobile/v2/jobs | ✓ | ✓ | ✓ | ✓ | No critical |
| POST /api/mobile/v2/jobs/[id]/escrow | ✓ | ✓ | ✓ | ✓ | ⚠️ STALE READ |
| POST /api/mobile/v2/jobs/[id]/release-escrow | ✓ | ✓ | ✓ | ✓ | ⚠️ DOUBLE CREDIT |
| POST /api/mobile/v2/jobs/[id]/cash-payment | ✓ | ✓ | ✓ | ✓ | ⚠️ STALE READ |
| POST /api/mobile/v2/wallet | ✓ | ✓ | ✓ | ✓ | ⚠️ STALE READ |
| POST /api/mobile/withdraw | ✓ | ✓ | ✓ | ✓ | ⚠️ NO BALANCE CHECK |
| GET /api/mobile/conversations/[id]/messages | ✓ | ✗ | ✗ | ✓ | N/A |
| PATCH /api/invoices/[id] | ✓ | ✗ | ✓ | ✓ | N/A |
| POST /api/reviews | ✗ | ✗ | ✗ | ✓ | N/A |
| POST /api/upload/cv | ✗ | ✗ | ✗ | ⚠️ | N/A |
| GET /api/files/[...path] | ✗ | ✗ | ✗ | ⚠️ TRAVERSAL | N/A |

## Lib File Security Checklist

| File | Auth Required | Permissions | Secure |
|---|---|---|---|
| `/api/lib/auth.ts` | YES | Yes | YES |
| `/api/lib/admin-auth.ts` | YES | Yes | PARTIAL |
| `/api/lib/middleware-helpers.ts` | YES | Yes | YES |
| `/api/lib/crm-auth.ts` | YES | Yes | YES |
| `/api/lib/api-utils.ts` | Optional | Yes | YES |
| `/api/lib/cors.ts` | N/A | N/A | BUGGY |
| `/api/lib/rate-limit.ts` | N/A | N/A | N/A |

## Recommendations

1. Unify middleware auth verifier with `lib/admin-auth.ts` (one JWT implementation)
2. Fix CORS wildcard bug in `lib/cors.ts`
3. Add origin validation to admin CORS
4. Add `Prisma.idempotencyKey` or `SELECT FOR UPDATE` to all financial mutations
5. Add `UniqueConstraintViolation` handling for duplicate prevention
6. Implement optimistic locking or distributed locks for wallet operations
