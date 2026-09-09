# 04C-INTEGRITY-AUDIT.md — Referential Integrity Audit

> Generated: Phase 4C.1 — FK Integrity Audit
> Scope: Canonical V2 marketplace models — scalar FK analysis

---

## AUDIT SCOPE

Canonical models analyzed:
- MarketplaceJob
- JobQuote
- JobWorkspace
- JobEscrow
- CommissionSettlement

---

## MARKETPLACEJOB

| Scalar FK | Target Model | Index | Orphan Risk | Recommendation |
|---|---|---|---|---|
| customerId | User | ✅ @@index | LOW — auth-gated creation | Add Prisma @relation + PostgreSQL FK |
| categoryId | JobCategory | ✅ @@index | LOW — seed validated | Add Prisma @relation + PostgreSQL FK |
| serviceTemplateId | ServiceTemplate | ❌ no index | LOW — optional | Add index. FK deferred (nullable) |
| templateJobId | TemplateJob | ❌ no index | LOW — optional | Add index. FK deferred (nullable) |
| targetTaskerId | TaskerProfile | ❌ no index | LOW — optional | Add index. FK deferred (nullable) |
| areaId | Area | ✅ @@index | LOW — optional | Add Prisma @relation + PostgreSQL FK |

**Production orphan check needed:** Yes — customerId, categoryId, areaId must have zero orphans before adding FK.

---

## JOBQUOTE

| Scalar FK | Target Model | Index | Orphan Risk | Recommendation |
|---|---|---|---|---|
| jobId | MarketplaceJob | ✅ @@index | LOW — lifecycle managed | Add Prisma @relation + PostgreSQL FK |
| providerId | User | ✅ @@index | LOW — auth-gated | Add Prisma @relation + PostgreSQL FK |

**Production orphan check needed:** Yes — jobId and providerId must have zero orphans.

---

## JOBWORKSPACE

| Scalar FK | Target Model | Index | Orphan Risk | Recommendation |
|---|---|---|---|---|
| jobId | MarketplaceJob | ✅ @@unique + @@index | LOW — upsert lifecycle | Add Prisma @relation + PostgreSQL FK. Unique constraint already exists. |

**Production orphan check needed:** Yes — jobId must have zero orphans.

---

## JOBESCROW

| Scalar FK | Target Model | Index | Orphan Risk | Recommendation |
|---|---|---|---|---|
| jobId | MarketplaceJob | ✅ @@index | LOW — lifecycle managed | Add Prisma @relation + PostgreSQL FK |
| quoteId | JobQuote | ❌ no index | LOW — lifecycle managed | Add index + Prisma @relation + PostgreSQL FK |
| customerId | User | ✅ @@index | LOW — auth-gated | Add Prisma @relation + PostgreSQL FK |
| providerId | User | ✅ @@index | LOW — auth-gated | Add Prisma @relation + PostgreSQL FK |

**Production orphan check needed:** Yes — all FKs must have zero orphans.

---

## COMMISSIONSETTLEMENT

| Scalar FK | Target Model | Index | Orphan Risk | Recommendation |
|---|---|---|---|---|
| jobId | MarketplaceJob | ✅ @@index | LOW — created with escrow release | Add Prisma @relation + PostgreSQL FK |
| escrowId | JobEscrow | ❌ no index | LOW — created with escrow release | Add index + Prisma @relation + PostgreSQL FK |
| providerId | User | ✅ @@index | LOW — auth-gated | Add Prisma @relation + PostgreSQL FK |
| customerId | User | ❌ no index | LOW — auth-gated | Add index |

**Production orphan check needed:** Yes — jobId, escrowId, providerId, customerId must have zero orphans.

---

## PRODUCTION ORPHAN COUNTS

To be queried on VPS before any FK migration:

```sql
-- MarketplaceJob.customerId orphans
SELECT COUNT(*) FROM "MarketplaceJob" mj
LEFT JOIN "User" u ON mj."customerId" = u.id
WHERE u.id IS NULL;

-- MarketplaceJob.categoryId orphans
SELECT COUNT(*) FROM "MarketplaceJob" mj
LEFT JOIN "JobCategory" jc ON mj."categoryId" = jc.id
WHERE jc.id IS NULL;

-- MarketplaceJob.areaId orphans (nullable)
SELECT COUNT(*) FROM "MarketplaceJob" mj
LEFT JOIN "Area" a ON mj."areaId" = a.id
WHERE mj."areaId" IS NOT NULL AND a.id IS NULL;

-- JobQuote.jobId orphans
SELECT COUNT(*) FROM "JobQuote" jq
LEFT JOIN "MarketplaceJob" mj ON jq."jobId" = mj.id
WHERE mj.id IS NULL;

-- JobQuote.providerId orphans
SELECT COUNT(*) FROM "JobQuote" jq
LEFT JOIN "User" u ON jq."providerId" = u.id
WHERE u.id IS NULL;

-- JobWorkspace.jobId orphans
SELECT COUNT(*) FROM "JobWorkspace" jw
LEFT JOIN "MarketplaceJob" mj ON jw."jobId" = mj.id
WHERE mj.id IS NULL;

-- JobEscrow.jobId orphans
SELECT COUNT(*) FROM "JobEscrow" je
LEFT JOIN "MarketplaceJob" mj ON je."jobId" = mj.id
WHERE mj.id IS NULL;

-- JobEscrow.quoteId orphans
SELECT COUNT(*) FROM "JobEscrow" je
LEFT JOIN "JobQuote" jq ON je."quoteId" = jq.id
WHERE jq.id IS NULL;

-- CommissionSettlement.jobId orphans
SELECT COUNT(*) FROM "CommissionSettlement" cs
LEFT JOIN "MarketplaceJob" mj ON cs."jobId" = mj.id
WHERE mj.id IS NULL;

-- CommissionSettlement.escrowId orphans
SELECT COUNT(*) FROM "CommissionSettlement" cs
LEFT JOIN "JobEscrow" je ON cs."escrowId" = je.id
WHERE je.id IS NULL;
```

---

## FK MIGRATION SAFETY RULES

1. NEVER add FK to a column with existing orphans
2. NEVER make a nullable column non-nullable without data proof
3. NEVER rename existing columns
4. NEVER drop existing columns
5. ALWAYS test on clean PostgreSQL first
6. ALWAYS verify production orphan count = 0 before constraint
7. If orphan count > 0: document remediation, do NOT apply constraint

---

## SUMMARY

| Model | Safe for FK | Condition |
|---|---|---|
| MarketplaceJob → User (customerId) | PENDING | Orphan check required |
| MarketplaceJob → JobCategory (categoryId) | PENDING | Orphan check required |
| MarketplaceJob → Area (areaId) | PENDING | Orphan check required (nullable) |
| JobQuote → MarketplaceJob (jobId) | PENDING | Orphan check required |
| JobQuote → User (providerId) | PENDING | Orphan check required |
| JobWorkspace → MarketplaceJob (jobId) | PENDING | Orphan check required |
| JobEscrow → MarketplaceJob (jobId) | PENDING | Orphan check required |
| JobEscrow → JobQuote (quoteId) | PENDING | Orphan check required + add index |
| CommissionSettlement → MarketplaceJob (jobId) | PENDING | Orphan check required |
| CommissionSettlement → JobEscrow (escrowId) | PENDING | Orphan check required + add index |
