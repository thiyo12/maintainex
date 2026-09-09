# 04B-CATALOG-TRANSITION.md — Catalog Source-of-Truth and Dual-Write Policy

> Generated: Phase 4B — Catalog Transition Design
> Scope: V1 Category+Service vs V2 JobCategory+TemplateJob+ServiceTemplate

---

## CURRENT STATE

### V1 Catalog

| Model | Rows | Used By | Write Sources |
|---|---|---|---|
| Category | 17 | Web admin, V1 booking | Admin API |
| Service | 77 | Web admin, V1 booking, V1 reviews | Admin API |

### V2 Catalog

| Model | Rows | Used By | Write Sources |
|---|---|---|---|
| JobCategory | 24 | Mobile app, matching, skills | Auto-seed (lib/v2-job-categories.ts) |
| TemplateJob | 239 | Mobile app, matching, skills, bookings | Auto-seed |
| ServiceTemplate | 239 | Mobile app, smart pricing | Auto-seed |

### Relationship

V1 and V2 catalogs are INDEPENDENT taxonomies:
- V1 Category → Service (admin-managed)
- V2 JobCategory → TemplateJob → ServiceTemplate (auto-seeded)

They do NOT share IDs, names, or hierarchy. They are parallel systems.

---

## SOURCE-OF-TRUTH DECISION

### For V2 Mobile App: JobCategory + TemplateJob + ServiceTemplate (CANONICAL)

The V2 mobile app exclusively uses the V2 catalog. All new marketplace features will use V2.

### For Web Admin: Category + Service (PRESERVE)

The web admin panel uses V1 catalog for:
- Service management
- Booking service selection
- Review service association
- Invoice line items

**Do NOT delete V1 catalog.** The web admin depends on it.

### For New Features: V2 Catalog Only

Any new feature (BOOK_NOW convergence, PROJECT mode, RECURRING) should write to V2 catalog only.

---

## DUAL-WRITE POLICY

**Decision: NO dual-write.**

V1 and V2 catalogs are independent. They serve different surfaces:
- V1 → web admin
- V2 → mobile app

There is no need to synchronize them. They represent different taxonomies:
- V1 Category+Service = business service catalog (admin-managed)
- V2 JobCategory+TemplateJob = job type catalog (auto-seeded)

---

## FUTURE CATALOG WRITES

| Write Type | Target | Notes |
|---|---|---|
| New job type | TemplateJob + ServiceTemplate | Auto-seeded or admin via new V2 admin endpoint |
| New category | JobCategory | Auto-seeded or admin via new V2 admin endpoint |
| New business service | Category + Service | Admin via existing V1 endpoint |
| Seasonal offer jobs | SeasonalOfferJob → TemplateJob | Admin via existing endpoint |

---

## CATALOG ADAPTER PATTERN (if needed)

If the web admin needs to display V2 catalog data:

```
Admin reads V2 catalog:
  GET /api/mobile/job-categories → JobCategory list
  GET /api/mobile/template-jobs → TemplateJob list

Admin reads V1 catalog:
  GET /api/categories → Category list
  GET /api/services → Service list
```

No adapter needed — they are separate read paths.

---

## SEED/AUTO-SEED POLICY

| Trigger | Action | Models |
|---|---|---|
| First call to /api/mobile/job-categories (count=0) | Auto-seed from lib/v2-job-categories.ts | JobCategory + TemplateJob + ServiceTemplate |
| Admin creates new service | Write to V1 | Category + Service |
| Developer runs seed script | Write to V2 | JobCategory + TemplateJob + ServiceTemplate |

**No synchronization between V1 and V2 seeds.**

---

## CONSOLIDATION RISK

| Risk | Severity | Mitigation |
|---|---|---|
| V1 and V2 catalogs diverge | LOW | They are independent — divergence is expected |
| Admin creates service not in V2 | LOW | V2 auto-seeds independently |
| V2 auto-seed overwrites admin changes | LOW | Auto-seed uses UPSERT — admin changes preserved if names match |
| Web admin needs V2 catalog | LOW | Add read-only V2 catalog endpoints to admin API |
