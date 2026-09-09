# 03E — Middleware Trust Boundary

## Middleware Responsibilities

The Edge middleware at `middleware.ts` handles:

1. **Security headers** — applied to all matched routes
2. **Rate limiting** — in-memory rate limiter per IP
3. **IP blocklist** — synced from internal API
4. **AI crawler detection** — special handling for AI bots
5. **Admin page auth gate** — redirects unauthenticated users to /admin/login
6. **Mobile CORS** — CORS headers for /api/mobile/*
7. **Path-based routing** — redirects legacy /admin/marketplace/* paths

## What Middleware Does NOT Do

- Does NOT verify UserSession validity (marketplace auth)
- Does NOT verify AdminSession validity (staff auth)
- Does NOT perform RBAC authorization
- Does NOT check account active/banned/suspended status
- Does NOT load current role/permissions from DB
- Does NOT check company membership or ownership

## Middleware Staff Auth

Middleware performs **cheap cryptographic screening only**:

```
Token → HMAC-SHA256 verify (Edge-compatible) → check type/aud/iss → extract {sub, sid}
```

This verifies:
- Token signature is valid (not forged)
- Token has correct type (`staff_access`)
- Token has correct audience (`maintainex-staff`)
- Token has correct issuer (`maintainex`)
- Token is not expired

This does NOT verify:
- AdminSession exists in DB
- AdminUser is active
- AdminUser is not deleted
- Current role/permissions

## Server-Side Route Auth

Every protected route performs full canonical auth:

```
getAdminSession() / getSession() / authenticateRequest()
  → verify JWT signature
  → lookup session in DB
  → verify session is active
  → load current user state from DB
  → return full auth context
```

This is the authoritative boundary. Routes NEVER rely on middleware alone.

## Route Classification

| Route Pattern | Middleware Auth | Route Auth | Both Required |
|---------------|----------------|------------|---------------|
| /admin/* (pages) | HMAC screen → redirect | N/A (page) | Middleware only |
| /api/admin/auth/* | Rate limit only | Route handles own auth | Route only |
| /api/admin/* (other) | HMAC screen | getAdminSession | Both |
| /api/mobile/* | CORS + rate limit | authenticateRequest | Route only |
| /api/* (other) | HMAC screen | getSession | Both |
| /setup/* | HMAC screen → redirect | N/A (dev only) | Middleware only |

## Conclusion

Middleware is a **cheap pre-filter** for admin pages. It is NOT the security boundary. All security decisions happen at the route handler level via canonical auth functions.
