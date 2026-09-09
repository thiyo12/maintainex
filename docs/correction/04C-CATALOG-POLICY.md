# 04C-CATALOG-POLICY.md — Catalog Write/Read Policy

> Generated: Phase 4C.6 — Catalog Policy
> Scope: V1/V2 catalog independence, write/read policy

---

## CANONICAL CATALOGS

### V2 (Mobile App) — CANONICAL for new work

| Model | Purpose | Rows |
|---|---|---|
| JobCategory | Job categories | 24 |
| TemplateJob | Service definitions | 239 |
| ServiceTemplate | Wizard/questions/pricing | 239 |

### V1 (Web Admin) — LEGACY

| Model | Purpose | Rows |
|---|---|---|
| Category | Business categories | 17 |
| Service | Business services | 77 |

---

## POLICY

### New marketplace V2 work

All NEW marketplace V2 service definitions use canonical V2 catalog.

### Admin catalog management

Admin UI manages V1 Category/Service. No hidden dual-write.

### Catalog independence

V1 and V2 catalogs are independent. They serve different surfaces:
- V1 → web admin
- V2 → mobile app

No synchronization. No dual-write.

---

## WRITE RULES

| Write Type | Target | Notes |
|---|---|---|
| New job type | TemplateJob + ServiceTemplate | Auto-seeded or admin via V2 admin endpoint |
| New category | JobCategory | Auto-seeded or admin via V2 admin endpoint |
| New business service | Category + Service | Admin via existing V1 endpoint |

---

## READ RULES

| Reader | V1 | V2 |
|---|---|---|
| Mobile app | ❌ | ✅ |
| Web admin | ✅ | ✅ (future) |
| Matching engine | ❌ | ✅ |
| Smart pricing | ❌ | ✅ |

---

## TEMPLATEJOB + SERVICETEMPLATE

Preserve 1:1 complementary responsibilities:
- **TemplateJob**: Human-readable service definition
- **ServiceTemplate**: Wizard/questions/pricing configuration

Do not merge.

---

## SEED POLICY

V2 auto-seed (lib/v2-job-categories.ts) uses UPSERT.
Admin V1 catalog changes are preserved if names match.
