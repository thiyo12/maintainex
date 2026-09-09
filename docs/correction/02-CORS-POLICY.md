# MaintainEX CORS Policy

## Current State

### Mobile API (`app/api/mobile/`)

| Issue | Status |
|---|---|
| Wildcard `*` origin | Present in some routes |
| Credentials allowed | Yes (`credentials: 'include'`) |

**Problem:** `Access-Control-Allow-Origin: *` with credentials is invalid per CORS spec. Browsers reject it. Mobile (Expo) native requests bypass CORS.

### Admin API (`app/api/admin/`)

| Issue | Status |
|---|---|
| Origin validation | None — any origin allowed |
| Credentials allowed | Yes |

**Problem:** No origin check. Any website can make authenticated admin requests.

## CORS Configuration

### Allowed Origins

| Environment | Origin | Purpose |
|---|---|---|
| Production | `https://maintainex.lk` | Web client |
| Production | `https://admin.maintainex.lk` | Admin client (if separate) |
| Staging | `https://staging.maintainex.lk` | Staging |
| Development | `http://localhost:3000` | Local dev |
| Development | `http://localhost:8081` | Expo web |

### Mobile Client

Expo native apps do NOT send CORS headers. CORS is browser-only. Mobile requests use `Authorization` headers directly. No CORS configuration needed for mobile.

### Implementation

Add to `next.config.js`:

```js
const allowedOrigins = [
  'https://maintainex.lk',
  'https://staging.maintainex.lk',
  'http://localhost:3000',
  'http://localhost:8081',
]

module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: allowedOrigins.join(','),
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With',
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
          },
        ],
      },
    ]
  },
}
```

**Note:** Next.js `headers()` does not support dynamic origin matching. For dynamic matching, use middleware or a custom server.

### Alternative: Middleware Approach

Create `middleware.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'

const allowedOrigins = [
  'https://maintainex.lk',
  'https://staging.maintainex.lk',
  'http://localhost:3000',
  'http://localhost:8081',
]

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin')
  
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
    }
    
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }
    
    return response
  }
  
  return NextResponse.next()
}
```

## Testing

| Test | Expected | Notes |
|---|---|---|
| Browser from `maintainex.lk` | PASS | Origin matches |
| Browser from `evil.com` | BLOCKED | Origin not in list |
| Expo native request | PASS | No CORS headers sent |
| Admin from unknown origin | BLOCKED | Origin not validated |

## Deferred

- Dynamic origin matching (requires middleware or custom server)
- Staging environment CORS
- Preview deployment CORS
