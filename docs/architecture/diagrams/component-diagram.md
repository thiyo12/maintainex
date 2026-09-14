# Component Diagram

Mermaid component diagrams for MaintainEX subsystems. Render with any Mermaid-compatible viewer.

---

## Marketplace API Components

```mermaid
graph TB
    subgraph "API Route Layer"
        JobRoutes["Job Routes<br/><i>/api/mobile/v2/jobs/*</i>"]
        QuoteRoutes["Quote Routes<br/><i>/api/mobile/v2/quotes/*</i>"]
        EscrowRoutes["Escrow Routes<br/><i>/api/mobile/v2/jobs/[id]/escrow/*</i>"]
        MatchRoutes["Match Routes<br/><i>/api/mobile/v2/match/*</i>"]
        PricingRoutes["Pricing Routes<br/><i>/api/mobile/v2/pricing/*</i>"]
        PinRoutes["PIN Routes<br/><i>/api/mobile/v2/jobs/[id]/pin/*</i>"]
    end

    subgraph "Auth Middleware"
        SessionCheck["Session Check<br/><i>getSessionFromCookie</i>"]
        SuspendCheck["Suspend Check<br/><i>assertNotSuspended</i>"]
        RBACCheck["RBAC Check<br/><i>getAdminSession</i>"]
    end

    subgraph "Domain Services"
        JobLifecycle["Job Lifecycle<br/><i>lib/domain/job-lifecycle.ts</i>"]
        CompanyAssignment["Company Assignment<br/><i>lib/domain/company-job-assignment.ts</i>"]
        CommercialImmut["Commercial Immutability<br/><i>lib/domain/commercial-immutability.ts</i>"]
    end

    subgraph "Matching Subsystem"
        Eligibility["Eligibility Engine<br/><i>lib/matching/eligibility.ts</i>"]
        Scoring["Scoring Engine<br/><i>lib/matching/scoring.ts</i>"]
        Waves["Wave Manager<br/><i>lib/matching/waves.ts</i>"]
        Ranking["Ranking<br/><i>lib/matching/ranking.ts</i>"]
    end

    subgraph "Pricing Subsystem"
        PricingEngine["Price Calculator<br/><i>lib/pricing/engine.ts</i>"]
        PricingRules["Rules Resolver<br/><i>lib/pricing/rules.ts</i>"]
        FeeCalc["Fee Calculator<br/><i>lib/pricing/fees.ts</i>"]
    end

    subgraph "Financial Subsystem"
        Ledger["Double-Entry Ledger<br/><i>lib/ledger.ts</i>"]
        EscrowLifecycle["Escrow Lifecycle<br/><i>job-lifecycle.ts</i>"]
        Commission["Commission Calc<br/><i>lib/mxid.ts</i>"]
    end

    subgraph "Data Layer"
        Prisma["Prisma Client"]
        PostgreSQL[("PostgreSQL")]
    end

    %% Route to Auth
    JobRoutes --> SessionCheck
    JobRoutes --> SuspendCheck
    QuoteRoutes --> SessionCheck
    QuoteRoutes --> SuspendCheck
    EscrowRoutes --> SessionCheck
    EscrowRoutes --> SuspendCheck
    MatchRoutes --> SessionCheck
    PricingRoutes --> SessionCheck
    PinRoutes --> SessionCheck

    AdminRoutes["Admin Routes"] --> RBACCheck

    %% Route to Domain
    JobRoutes --> JobLifecycle
    JobRoutes --> CommercialImmut
    QuoteRoutes --> CommercialImmut
    QuoteRoutes --> JobLifecycle
    EscrowRoutes --> EscrowLifecycle
    PinRoutes --> JobLifecycle

    %% Domain to Matching
    MatchRoutes --> Eligibility
    MatchRoutes --> Scoring
    MatchRoutes --> Waves
    MatchRoutes --> Ranking

    %% Route to Pricing
    PricingRoutes --> PricingEngine
    PricingEngine --> PricingRules
    PricingEngine --> FeeCalc

    %% Financial
    EscrowRoutes --> Ledger
    JobLifecycle --> Ledger
    Ledger --> Commission

    %% Company Assignment
    JobRoutes --> CompanyAssignment

    %% All to Prisma
    JobLifecycle --> Prisma
    Eligibility --> Prisma
    Scoring --> Prisma
    Waves --> Prisma
    PricingEngine --> Prisma
    Ledger --> Prisma
    CompanyAssignment --> Prisma

    Prisma --> PostgreSQL
```

---

## Mobile App Components

```mermaid
graph TB
    subgraph "Expo Router Screens"
        AuthScreens["Auth Screens<br/><i>Login, Register, OTP</i>"]
        CustomerScreens["Customer Screens<br/><i>Jobs, Quotes, Bookings</i>"]
        ProviderScreens["Provider Screens<br/><i>Opportunities, Work, Schedule</i>"]
        MapScreen["Map View<br/><i>Provider locations</i>"]
    end

    subgraph "State Management"
        ReactQuery["React Query<br/><i>Server state caching</i>"]
        AuthContext["Auth Context<br/><i>JWT token management</i>"]
    end

    subgraph "API Layer"
        APIClient["API Client<br/><i>apps/mobile/lib/api.ts</i>"]
        PushManager["Push Manager<br/><i>Expo Push Token</i>"]
    end

    subgraph "Native Modules"
        Camera["Camera<br/><i>Work evidence photos</i>"]
        Maps["Maps<br/><i>Apple Maps / Android</i>"]
        Location["Location<br/><i>GPS for service area</i>"]
    end

    %% Screens to State
    AuthScreens --> AuthContext
    CustomerScreens --> ReactQuery
    ProviderScreens --> ReactQuery

    %% State to API
    ReactQuery --> APIClient
    AuthContext --> APIClient

    %% API to External
    APIClient -->|"HTTPS"| NextJSBackend["Next.js Backend"]

    %% Push
    PushManager --> ExpoPushService["Expo Push Service"]
    ExpoPushService -->|"Push notification"| ProviderScreens

    %% Native
    MapScreen --> Maps
    ProviderScreens --> Camera
    ProviderScreens --> Location
```

---

## Admin Panel Components

```mermaid
graph TB
    subgraph "Admin Pages"
        Dashboard["Dashboard<br/><i>app/admin/page.tsx</i>"]
        Users["User Management<br/><i>app/admin/users/</i>"]
        Jobs["Job Management<br/><i>app/admin/jobs/</i>"]
        Finance["Finance<br/><i>app/admin/finance/</i>"]
        Security["Security<br/><i>app/admin/security/</i>"]
        Queue["Work Queue<br/><i>app/admin/queue/</i>"]
    end

    subgraph "RBAC Layer"
        PermissionCheck["Permission Check<br/><i>ROLE_PERMISSIONS map</i>"]
        SessionMgmt["Session Management<br/><i>AdminSession + JWT</i>"]
        AuditLog["Audit Logging<br/><i>writeCompanyAuditLog</i>"]
    end

    subgraph "API Routes"
        AdminAPIRoutes["/api/admin/*<br/><i>Admin API handlers</i>"]
    end

    subgraph "Domain"
        UserMgmt["User Suspension<br/><i>assertNotSuspended</i>"]
        JobMgmt["Job Moderation<br/><i>cancel, flag, refund</i>"]
        CommissionMgmt["Commission<br/><i>settlement, payout</i>"]
    end

    %% Pages to RBAC
    Dashboard --> PermissionCheck
    Users --> PermissionCheck
    Jobs --> PermissionCheck
    Finance --> PermissionCheck
    Security --> PermissionCheck
    Queue --> PermissionCheck

    PermissionCheck --> SessionMgmt

    %% Pages to API
    Users --> AdminAPIRoutes
    Jobs --> AdminAPIRoutes
    Finance --> AdminAPIRoutes
    Security --> AdminAPIRoutes
    Queue --> AdminAPIRoutes

    %% API to Domain
    AdminAPIRoutes --> UserMgmt
    AdminAPIRoutes --> JobMgmt
    AdminAPIRoutes --> CommissionMgmt

    %% Audit
    AdminAPIRoutes --> AuditLog
```
