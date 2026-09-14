# Marketplace API Routes Structure

C4 Level 3 — API routes, middleware chain, and auth flow for the marketplace API.

---

## Overview

The marketplace API is served by Next.js App Router route handlers under `app/api/mobile/`. Two versions coexist: v1 (legacy) and v2 (current). All routes use REST conventions with JSON payloads.

---

## Route Map

```mermaid
graph TB
    subgraph API["app/api/mobile/"]
        direction TB
        subgraph AuthRoutes["Auth Routes"]
            Login["/auth/login"]
            Register["/auth/register"]
            SendOTP["/auth/send-otp"]
            VerifyOTP["/auth/verify-otp"]
            OTPLogin["/auth/otp-login"]
            Refresh["/auth/refresh"]
            Logout["/auth/logout"]
            Me["/auth/me"]
            Profile["/auth/profile"]
            ForgotPW["/auth/forgot-password"]
            ResetPW["/auth/reset-password"]
        end

        subgraph JobRoutes["Job Routes"]
            Jobs["/jobs\n(GET, POST)"]
            JobDetail["/jobs/[id]\n(GET, PATCH)"]
            JobBid["/jobs/[id]/bid\n(POST)"]
        end

        subgraph V2Routes["V2 Routes"]
            V2Jobs["/v2/jobs\n(GET, POST)"]
            V2JobDetail["/v2/jobs/[id]\n(GET, PATCH)"]
            V2Quotes["/v2/quotes\n(GET, POST)"]
            V2Match["/v2/match/[jobId]\n(POST)"]
            V2Pricing["/v2/pricing/*\n(estimate, confirm, materials)"]
            V2BookNow["/v2/book-now\n(POST)"]
            V2CustomJobs["/v2/custom-jobs\n(GET, POST)"]
            V2Availability["/v2/availability\n(GET, POST)"]
            V2Identity["/v2/identity\n(GET, POST)"]
            V2Schedule["/v2/schedule\n(GET)"]
            V2Quality["/v2/quality\n(GET)"]
        end

        subgraph ProviderRoutes["Provider Routes"]
            Taskers["/taskers\n(GET)"]
            TaskerDetail["/taskers/[id]\n(GET)"]
            TaskerProfile["/taskers/profile\n(GET, PATCH)"]
            FindTasker["/find-tasker\n(GET)"]
        end

        subgraph CompanyRoutes["Company Routes"]
            CompanyProfile["/company/profile\n(GET, PATCH)"]
            CompanyTeam["/company/team\n(GET, POST)"]
            CompanyMembers["/company/members\n(GET)"]
            CompanyAssign["/company/assign\n(POST)"]
            CompanyContracts["/company/contracts\n(GET, POST)"]
        end

        subgraph FinanceRoutes["Finance Routes"]
            Earnings["/earnings\n(GET)"]
            Withdraw["/withdraw\n(POST)"]
            Escrows["/v2/admin/escrows\n(GET)"]
            Settle["/v2/admin/commission-settle\n(POST)"]
        end

        subgraph SupportRoutes["Support Routes"]
            Disputes["/disputes\n(GET, POST)"]
            DisputeDetail["/disputes/[id]\n(GET, PATCH)"]
            Notifications["/notifications\n(GET)"]
            Conversations["/conversations\n(GET, POST)"]
        end

        subgraph UtilityRoutes["Utility Routes"]
            Upload["/upload\n(POST)"]
            Search["/search\n(GET)"]
            Categories["/job-categories\n(GET)"]
            Templates["/template-jobs\n(GET)"]
            Professions["/v2/professions\n(GET)"]
        end
    end

    style API fill:#1a1a2e,stroke:#e94560,color:#fff
    style AuthRoutes fill:#533483,stroke:#e94560,color:#fff
    style JobRoutes fill:#16213e,stroke:#0f3460,color:#fff
    style V2Routes fill:#16213e,stroke:#0f3460,color:#fff
    style ProviderRoutes fill:#16213e,stroke:#0f3460,color:#fff
    style CompanyRoutes fill:#16213e,stroke:#0f3460,color:#fff
    style FinanceRoutes fill:#16213e,stroke:#0f3460,color:#fff
    style SupportRoutes fill:#16213e,stroke:#0f3460,color:#fff
    style UtilityRoutes fill:#16213e,stroke:#0f3460,color:#fff
```

---

## Middleware Chain

Every request passes through the global middleware defined in `middleware.ts`.

```mermaid
graph TD
    A[Incoming Request] --> B[Security Headers]
    B --> C[Rate Limit Check]
    C -->|Exceeded| D[429 Too Many Requests]
    C -->|OK| E{Route Type?}
    E -->|/api/admin/*| F[Admin Auth: Cookie/Bearer JWT]
    E -->|/api/mobile/*| G[Mobile Auth: Bearer JWT]
    E -->|Public| H[No Auth Required]
    F --> I[RBAC Permission Check]
    G --> J[assertNotSuspended Check]
    I --> K[Route Handler]
    J --> K
    H --> K
```

### Security Headers

Applied to all responses (`middleware.ts:12-22`):

```
X-DNS-Prefetch-Control: on
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### Rate Limits

Defined in `middleware.ts:32-36`:

| Category | Max Requests | Window |
|---|---|---|
| Default | 100 | 60 seconds |
| Auth (`/auth/*`) | 5 | 60 seconds |
| Admin | 200 | 60 seconds |

---

## Auth Flow (Mobile)

### Token Verification

```mermaid
sequenceDiagram
    participant C as Client
    participant MW as Middleware
    participant API as Route Handler
    participant DB as Database

    C->>MW: Request + Authorization: Bearer <token>
    MW->>MW: verifySimpleToken()
    MW->>MW: HMAC-SHA256 signature check
    MW->>MW: Expiry check
    alt Token valid
        MW->>API: Attach user context
        API->>DB: assertNotSuspended(userId)
        alt Not suspended
            API->>API: Process request
        else Suspended
            API-->>C: 403 Account Suspended
        end
    else Token invalid
        MW-->>C: 401 Unauthorized
    end
```

### JWT Claims (Marketplace)

Defined in `lib/auth/marketplace-jwt.ts:19-28`:

```typescript
interface MarketplaceAccessTokenClaims {
  sub: string      // User ID
  sid: string      // Session ID
  aud: string      // "maintainex-marketplace"
  iss: string      // "maintainex"
  jti: string      // Unique token ID
  type: string     // "marketplace_access"
  iat: number      // Issued at
  exp: number      // Expires at
}
```

Token lifetime: 15 minutes (access), 30 days (refresh).

---

## Suspension Enforcement

`assertNotSuspended()` is called on all write routes (41+ routes). Blocks:

- `isSuspended === true` — Returns 403 with suspension reason
- `isBanned === true` — Returns 403 with ban reason
- Login blocked for suspended/banned users

---

## IDOR Protection

The `GET /api/mobile/v2/jobs/[id]` endpoint includes ownership verification:

1. Fetch job with ownership fields
2. Verify requesting user is the customer, provider, or company member
3. Redact sensitive fields (internal notes, admin flags) for non-admin users

---

## Request/Response Conventions

| Convention | Pattern |
|---|---|
| Pagination | `?page=1&limit=20` |
| Filtering | `?status=OPEN&category=...` |
| Sorting | `?sort=createdAt&order=desc` |
| Error format | `{ error: string, code?: string }` |
| Success format | `{ data: T }` or `{ data: T[], meta: { total, page, limit } }` |

---

## Route Count Summary

| Group | Routes | Notes |
|---|---|---|
| Auth | 11 | Login, register, OTP, profile |
| Jobs (v1) | 3 | Legacy, being migrated to v2 |
| Jobs (v2) | 8 | Current, full lifecycle |
| Providers | 5 | Search, profile, eligibility |
| Companies | 12 | Profile, team, contracts, assignments |
| Finance | 4 | Earnings, withdrawals, settlement |
| Support | 5 | Disputes, notifications, messaging |
| Utility | 8 | Upload, search, categories, templates |
| **Total** | **56+** | v1 + v2 coexistence |

---

## References

- Mobile auth: `lib/auth/marketplace-jwt.ts`
- Auth constants: `lib/auth/constants.ts`
- Middleware: `middleware.ts`
- Security: [security-layers.md](./security-layers.md)
- Authentication: [authentication.md](./authentication.md)
