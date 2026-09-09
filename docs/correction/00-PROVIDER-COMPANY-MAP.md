# MaintainEX Provider & Company Map

## Two Provider Types

| Type | Model | Profile | Commission | KYC |
|---|---|---|---|---|
| Individual | `User` (role=PROVIDER) | `TaskerProfile` | 0% default (bug) | IdentityDocument |
| Company | `CompanyProfile` (role=COMPANY) | `CompanyProfile` | Configurable per company | Company KYC |

## Individual Provider Stack

| Model | Purpose |
|---|---|
| `TaskerProfile` | Bio, hourly rate, experience, rating, completed jobs |
| `TaskerSkill` | Links provider to TemplateJob categories |
| `TaskerBadge` | Achievement badges |
| `ProviderAvailability` | Weekly schedule, time slots |
| `ProviderPerformance` | Per-category stats, earnings |
| `IdentityDocument` | KYC verification |
| `ProviderWallet` | Float availableBalance, pendingBalance |

## Company Provider Stack

| Model | Purpose |
|---|---|
| `CompanyProfile` | Company name, description, commissionRate, verified, rating |
| `TeamMember` | Workers assigned to company |
| `TeamInvite` | Pending invitations |
| `CompanySpecialty` | Service categories |
| `CompanySubscription` | Active subscription plan |
| `Contract` | Client contracts with milestones |

## Provider Commission Bug (P1)

```typescript
// lib/pricing-helpers.ts — getProviderCommissionRate()
const company = await prisma.companyProfile.findUnique({ where: { userId: providerId } })
return company?.commissionRate ?? 0  // Individual providers ALWAYS return 0%
```

Individual providers (no CompanyProfile) default to 0% commission. Only companies with a CompanyProfile have configurable commission rates.

## Provider-to-Company Assignment

```
User (role=PROVIDER)
  └── TaskerProfile
        └── ProviderPerformance (per category)
        └── ProviderWallet

User (role=COMPANY)
  └── CompanyProfile
        └── TeamMember[] (workers)
        └── CompanySpecialty[]
        └── CompanySubscription
        └── Contract[]
```

## KYC Flow

| Step | Individual | Company |
|---|---|---|
| 1 | Upload IdentityDocument | Upload company docs |
| 2 | Admin review (`GET /api/admin/kyc`) | Admin review |
| 3 | `identityStatus: VERIFIED` | `verified: true` |
| 4 | Can submit quotes | Can create jobs |

Quotes require `identityStatus === 'VERIFIED'` — enforced in `POST /api/mobile/v2/quotes`.
