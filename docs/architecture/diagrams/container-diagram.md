# Container Diagram

C4 Container diagram for MaintainEX. Render with any Mermaid-compatible viewer.

---

## Diagram Source

```mermaid
graph TB
    subgraph "External Actors"
        Customer["Customer<br/><i>Web + Mobile</i>"]
        Provider["Provider<br/><i>Mobile App</i>"]
        AdminStaff["Admin Staff<br/><i>Web Browser</i>"]
    end

    subgraph "MaintainEX Platform"
        subgraph "Web Tier"
            NextJS["Next.js 14<br/><i>App Router, SSR, API</i>"]
            Cloudflare["Cloudflare<br/><i>CDN, DDoS, SSL</i>"]
            Traefik["Traefik<br/><i>Reverse Proxy, Routing</i>"]
        end

        subgraph "Mobile Tier"
            ExpoApp["Expo React Native<br/><i>iOS + Android</i>"]
        end

        subgraph "API Layer"
            MobileAPI["/api/mobile/v2<br/><i>Mobile API Routes</i>"]
            AdminAPI["/api/admin<br/><i>Admin API Routes</i>"]
            WebPages["/(customer)/*<br/><i>Web Pages (SSR)</i>"]
        end

        subgraph "Domain Layer"
            JobLifecycle["Job Lifecycle<br/><i>lib/domain/job-lifecycle.ts</i>"]
            MatchingEngine["Matching Engine<br/><i>lib/matching/</i>"]
            PricingEngine["Pricing Engine<br/><i>lib/pricing/</i>"]
            Ledger["Financial Ledger<br/><i>lib/ledger.ts</i>"]
            ProfessionTaxonomy["Profession Taxonomy<br/><i>lib/profession/</i>"]
        end

        subgraph "Auth Layer"
            MobileAuth["Mobile Auth<br/><i>JWT + OTP</i>"]
            AdminAuth["Admin Auth<br/><i>JWT + RBAC</i>"]
        end
    end

    subgraph "Data Layer"
        PostgreSQL[("PostgreSQL<br/><i>Primary Database</i>")]
        PrismaORM["Prisma ORM<br/><i>Schema + Migrations</i>"]
    end

    subgraph "External Services"
        ExpoPush["Expo Push Notifications"]
        CloudflareDNS["Cloudflare DNS"]
        AppStore["App Store / Play Store"]
    end

    %% Connections
    Customer --> Cloudflare
    Provider --> ExpoApp
    AdminStaff --> Cloudflare

    Cloudflare --> Traefik
    Traefik --> NextJS
    Traefik --> WebPages

    ExpoApp -->|"HTTPS + Bearer Token"| MobileAPI
    NextJS --> AdminAPI
    NextJS --> MobileAPI

    MobileAPI --> JobLifecycle
    MobileAPI --> MatchingEngine
    MobileAPI --> PricingEngine
    MobileAPI --> Ledger
    MobileAPI --> ProfessionTaxonomy

    AdminAPI --> JobLifecycle
    AdminAPI --> Ledger

    MobileAuth -->|"JWT verify"| MobileAPI
    AdminAuth -->|"JWT + RBAC"| AdminAPI

    JobLifecycle --> PrismaORM
    MatchingEngine --> PrismaORM
    PricingEngine --> PrismaORM
    Ledger --> PrismaORM
    ProfessionTaxonomy --> PrismaORM

    PrismaORM --> PostgreSQL

    MobileAPI -->|"Send push"| ExpoPush
    ExpoPush -->|"Push delivery"| ExpoApp

    ExpoApp -->|"App updates"| AppStore
    Cloudflare --> CloudflareDNS
```

---

## Legend

| Shape | Meaning |
|-------|---------|
| Rectangle | Software system or container |
| Cylinder | Database |
| Subgraph | Logical boundary |
| Arrow | Data flow or dependency |

---

## Key Relationships

- **Customer** interacts via web (Cloudflare -> Traefik -> Next.js) or mobile (Expo -> API)
- **Provider** interacts primarily via mobile app
- **Admin Staff** interacts via web admin panel
- All API routes share the same domain layer
- Prisma ORM is the sole database access layer
- PostgreSQL is the only database (no Redis, no message queue)
