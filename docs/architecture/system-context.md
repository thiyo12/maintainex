# System Context

C4 Level 1 — System Context diagram for MaintainEX.

---

## Actors

| Actor | Description | Auth Method |
|---|---|---|
| **Customer** | Posts jobs, reviews providers, makes payments | JWT (marketplace), OTP |
| **Tasker / Provider** | Individual service provider, submits quotes, completes jobs | JWT (marketplace), OTP |
| **Company** | Business entity with team members, manages multiple providers | JWT (marketplace), company membership |
| **Admin (Staff)** | Platform operations: KYC, disputes, finance, technical | JWT (staff), 2FA (TOTP) |
| **System (Cron)** | Background jobs: wave expiry, settlement, notifications | Internal / service mesh |

---

## Context Diagram

```mermaid
graph TB
    subgraph External
        PaymentProvider["Payment Provider\n(Card / Cash)"]
        SMSGateway["SMS Gateway\n(OTP Delivery)"]
        PushService["Expo Push\nNotifications"]
        MapsService["Google Maps\n(geocoding)"]
        Cloudflare["Cloudflare\n(CDN / Edge)"]
    end

    subgraph Actors
        Customer["Customer\n(Mobile App)"]
        Tasker["Tasker / Provider\n(Mobile App)"]
        Company["Company\n(Mobile App)"]
        Admin["Admin Staff\n(Web Admin Panel)"]
    end

    subgraph MaintainEX["MaintainEX Platform"]
        WebApp["Next.js Web App\n(Site + Admin Panel)"]
        MobileAPI["Next.js API\n(Mobile API v1/v2)"]
        AdminAPI["Next.js API\n(Admin API)"]
    end

    Customer -->|"POST jobs, pay"| WebApp
    Tasker -->|"Submit quotes, accept jobs"| WebApp
    Company -->|"Manage team, assign workers"| WebApp
    Admin -->|"Manage users, disputes, finance"| WebApp

    MobileAPI -->|"REST / JSON"| Customer
    MobileAPI -->|"REST / JSON"| Tasker
    MobileAPI -->|"REST / JSON"| Company
    AdminAPI -->|"REST / JSON"| Admin

    WebApp -->|"Process payments"| PaymentProvider
    WebApp -->|"Send OTP codes"| SMSGateway
    WebApp -->|"Send push alerts"| PushService
    WebApp -->|"Geocode locations"| MapsService
    Cloudflare -->|"Terminated HTTPS"| WebApp

    style MaintainEX fill:#1a1a2e,stroke:#e94560,color:#fff
    style External fill:#16213e,stroke:#0f3460,color:#fff
    style Actors fill:#533483,stroke:#e94560,color:#fff
```

---

## System Boundaries

### Inside MaintainEX

- **Web Application** — Next.js 14 App Router serving the public website, customer portal, and admin panel. Routes are defined in `app/` with API handlers in `app/api/`.
- **Mobile API** — REST API consumed by the Expo mobile app. Two versions coexist: v1 (legacy) and v2 (current). Defined in `app/api/mobile/`.
- **Admin API** — Internal API for the admin panel. Protected by staff JWT with role-based access control. Defined in `app/api/admin/`.

### Outside MaintainEX

| Integration | Protocol | Purpose |
|---|---|---|
| Payment Provider | HTTPS | Card processing, cash-to-agent commission |
| SMS Gateway | HTTPS | OTP delivery for phone-based auth |
| Expo Push Service | HTTPS | Mobile push notifications |
| Google Maps API | HTTPS | Geocoding, distance calculations |
| Cloudflare | HTTPS/TLS | CDN termination, DDoS protection, security headers |

---

## Data Flows

### Job Lifecycle Flow

```mermaid
sequenceDiagram
    participant C as Customer
    participant API as MaintainEX
    participant P as Provider
    participant E as Escrow

    C->>API: POST /v2/jobs (create job)
    API->>API: Matching engine runs (eligibility + scoring)
    API->>P: Wave 1 notification (top 3 providers)
    P->>API: POST /v2/quotes (submit quote)
    C->>API: Accept quote
    API->>E: Create escrow (PENDING_PAYMENT)
    C->>E: Fund escrow
    API->>P: Notify: job workspace ready
    P->>API: POST completion request
    C->>API: Confirm completion
    API->>E: Release escrow
    API->>API: Post ledger transaction (settlement)
```

### Auth Flow

```mermaid
sequenceDiagram
    participant M as Mobile App
    participant API as MaintainEX
    participant SMS as SMS Gateway

    M->>API: POST /auth/send-otp (phone)
    API->>SMS: Deliver OTP
    API->>API: Rate limit check (3/phone/hr, 5/IP/hr)
    M->>API: POST /auth/verify-otp (phone + code)
    API->>API: Lock check (5 wrong = lock)
    API->>API: Generate JWT (18d TTL)
    API-->>M: Access token + refresh token
```

---

## Trust Boundaries

| Boundary | Mechanism |
|---|---|
| Client <-> Platform | TLS 1.3 (via Cloudflare), HSTS enforced |
| Platform <-> Database | Same Docker network, no external exposure |
| Platform <-> External APIs | Outbound HTTPS only, secrets in environment |
| Admin Panel | Staff JWT + RBAC (6 roles), session table with revocation |
| Mobile Auth | Marketplace JWT (18d) + refresh tokens, phone OTP |
| Financial Operations | Double-entry ledger, idempotency keys, commission config |

---

## References

- Container diagram: [container.md](./container.md)
- Authentication: [authentication.md](./authentication.md)
- Security: [security-layers.md](./security-layers.md)
