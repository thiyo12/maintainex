# Data Flow Diagrams

Mermaid sequence diagrams for key MaintainEX flows. Render with any Mermaid-compatible viewer.

---

## Booking Flow (Customer Posts Job, Provider Accepts)

```mermaid
sequenceDiagram
    participant C as Customer
    participant Web as Next.js Web
    participant API as /api/mobile/v2
    participant ME as Matching Engine
    participant DB as PostgreSQL
    participant P as Provider (Mobile)

    C->>Web: POST /jobs (title, category, description)
    Web->>API: Create job request
    API->>DB: INSERT MarketplaceJob (status: OPEN)
    API->>ME: Trigger matching for jobId

    ME->>DB: Query eligible providers
    ME->>ME: Evaluate eligibility gates
    ME->>ME: Score candidates
    ME->>ME: Create wave 1 (top 3 providers)

    loop For each wave candidate
        ME->>DB: INSERT ProviderOpportunity
        ME->>P: Push notification (new opportunity)
    end

    P->>API: GET /jobs/[id] (view job details)
    P->>API: POST /quotes (price, timeline)
    API->>DB: INSERT JobQuote (status: PENDING)

    C->>API: GET /jobs/[id]/quotes
    API->>DB: Query quotes for job
    C->>API: POST /jobs/[id]/select-quote (quoteId)
    API->>DB: UPDATE JobQuote SET status = ACCEPTED
    API->>DB: UPDATE MarketplaceJob SET status = QUOTE_ACCEPTED

    C->>API: POST /jobs/[id]/escrow (amount)
    API->>DB: INSERT JobEscrow (status: PENDING_PAYMENT)
    API->>Ledger: POST /ledger/transaction (deposit)
    Ledger->>DB: INSERT LedgerEntry (debit + credit)

    P->>API: POST /jobs/[id]/pin (generate PIN)
    API->>DB: INSERT JobVerificationPin (hashed PIN)
    P-->>C: Read PIN verbally

    P->>API: POST /jobs/[id]/pin/verify (PIN)
    API->>DB: Verify PIN hash
    API->>DB: UPDATE MarketplaceJob SET status = IN_PROGRESS

    P->>API: POST /jobs/[id]/complete
    API->>DB: UPDATE MarketplaceJob SET status = COMPLETED
    API->>DB: UPDATE JobEscrow SET status = RELEASED
    API->>Ledger: POST /ledger/transaction (release)
    Ledger->>DB: INSERT LedgerEntry (debit + credit)
```

---

## Payment Flow (Escrow Lifecycle)

```mermaid
sequenceDiagram
    participant C as Customer
    participant API as /api/mobile/v2
    participant DB as PostgreSQL
    participant Ledger as Financial Ledger
    participant P as Provider

    Note over C,DB: Job created, quote accepted

    C->>API: POST /jobs/[id]/escrow (deposit)
    API->>DB: Check assertJobFinanciallyMutable
    API->>DB: INSERT JobEscrow (status: PENDING_PAYMENT)
    API->>Ledger: postLedgerTransaction
    Ledger->>DB: DEBIT: CustomerWallet, CREDIT: Escrow
    API->>DB: UPDATE JobEscrow SET status = PROTECTED

    Note over C,DB: Work completed

    P->>API: POST /jobs/[id]/complete
    API->>DB: UPDATE JobEscrow SET status = RELEASED
    API->>Ledger: postLedgerTransaction (release)
    Ledger->>DB: DEBIT: Escrow, CREDIT: ProviderWallet
    Ledger->>DB: DEBIT: Escrow, CREDIT: PlatformFee (commission)

    Note over C,DB: Refund scenario (if disputed)

    C->>API: POST /jobs/[id]/escrow/refund
    API->>DB: Check assertJobFinanciallyMutable
    API->>DB: UPDATE JobEscrow SET status = REFUNDED
    API->>Ledger: postLedgerTransaction (refund)
    Ledger->>DB: DEBIT: Escrow, CREDIT: CustomerWallet
```

---

## Matching Flow (Wave Progression)

```mermaid
sequenceDiagram
    participant API as /api/mobile/v2
    participant ME as Matching Engine
    participant Elig as Eligibility Engine
    participant Score as Scoring Engine
    participant Wave as Wave Manager
    participant DB as PostgreSQL
    participant Push as Expo Push

    API->>ME: Trigger matching for jobId

    ME->>DB: Query all providers in job category + country

    loop For each provider
        ME->>Elig: evaluateEligibility(provider, job)
        Elig->>DB: Check account status
        Elig->>DB: Check profession match
        Elig->>DB: Check service area
        Elig-->>ME: EligibilityResult (gates pass/fail)
    end

    ME->>ME: Filter eligible providers only

    loop For each eligible provider
        ME->>Score: calculateScore(provider, job)
        Score->>DB: Query provider history
        Score-->>ME: ScoreComponents + total score
    end

    ME->>ME: Sort by score descending

    ME->>Wave: createMatchingWave(jobId, wave=1, top 3)
    Wave->>DB: Query existing ProviderOpportunities (idempotency check)
    Wave->>DB: INSERT ProviderOpportunity (per candidate)
    Wave->>Push: Send push notification (per candidate)

    Note over Wave,DB: Wave 1 expires after 15 min, no acceptance

    ME->>Wave: createMatchingWave(jobId, wave=2, top 5)
    Wave->>DB: INSERT ProviderOpportunity (new candidates)
    Wave->>Push: Send push notification

    Note over Wave,DB: Wave 2 expires after 15 min, no acceptance

    ME->>Wave: createMatchingWave(jobId, wave=3, top 8)
    Wave->>DB: INSERT ProviderOpportunity (expanded pool)
    Wave->>Push: Send push notification
```

---

## Admin Job Moderation Flow

```mermaid
sequenceDiagram
    participant Admin as Admin Staff
    participant Web as Admin Panel
    participant RBAC as RBAC Check
    participant API as /api/admin
    participant DB as PostgreSQL
    participant Ledger as Financial Ledger
    participant Audit as Audit Log

    Admin->>Web: Navigate to job detail
    Web->>API: GET /api/admin/jobs/[id]
    API->>RBAC: getAdminSession()
    RBAC->>DB: Verify JWT + role permissions
    RBAC-->>API: Session (role: MANAGER, permissions: [...])
    API->>DB: Query MarketplaceJob + quotes + escrow
    API-->>Admin: Job detail data

    Admin->>Web: Click "Cancel Job"
    Web->>API: PATCH /api/admin/jobs/[id]
    API->>RBAC: Check permission (jobs:manage)
    API->>DB: Check assertJobFinanciallyMutable
    API->>DB: UPDATE MarketplaceJob SET status = CANCELLED

    opt Escrow exists and is PROTECTED
        API->>DB: UPDATE JobEscrow SET status = REFUNDED
        API->>Ledger: postLedgerTransaction (refund)
        Ledger->>DB: DEBIT: Escrow, CREDIT: CustomerWallet
    end

    API->>Audit: writeCompanyAuditLog (JOB_CANCELLED)
    Audit->>DB: INSERT AuditLog
    API-->>Admin: Success response
```

---

## Cash-to-Agent Payment Flow

```mermaid
sequenceDiagram
    participant P as Provider
    participant API as /api/mobile/v2
    participant DB as PostgreSQL
    participant Ledger as Financial Ledger

    P->>API: POST /jobs/[id]/cash-payment (amount, proof)
    API->>DB: Check assertJobFinanciallyMutable
    API->>DB: Check job status = IN_PROGRESS or COMPLETED
    API->>DB: INSERT CashPayment record

    API->>Ledger: postLedgerTransaction
    Ledger->>DB: DEBIT: CustomerWallet, CREDIT: AgentHold
    Ledger->>DB: DEBIT: AgentHold, CREDIT: ProviderWallet

    API->>DB: UPDATE JobEscrow SET status = RELEASED
    API-->>P: Cash payment recorded

    Note over P,DB: Admin settles commission later

    Admin->>API: POST /api/admin/commission/settle
    API->>DB: Query unreleased escrows
    API->>Ledger: postLedgerTransaction (commission)
    Ledger->>DB: DEBIT: ProviderWallet, CREDIT: PlatformFee
```
