# Architecture Decision Records

MaintainEX uses ADRs to document significant architectural decisions. Each ADR follows the format: Status, Context, Decision, Consequences.

---

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](./001-double-entry-ledger.md) | Double-Entry Ledger for Financial Records | Accepted | 2026-09-14 |
| [002](./002-job-verification-pin.md) | 6-Digit PIN for WORK_START Verification | Accepted | 2026-09-14 |
| [003](./003-matching-engine-waves.md) | Wave-Based Matching with Progressive Expansion | Accepted | 2026-09-14 |
| [004](./004-pricing-templates.md) | Template-Based Pricing with Budget Override | Accepted | 2026-09-14 |
| [005](./005-multi-tenant-rbac.md) | 6-Role RBAC with Country-Scoped Isolation | Accepted | 2026-09-14 |
| [006](./006-company-workforce.md) | Company-to-Worker Assignment Model | Accepted | 2026-09-14 |
| [007](./007-mobile-first.md) | Next.js + Expo Dual-Platform Approach | Accepted | 2026-09-14 |
| [008](./008-idempotency-pattern.md) | Idempotency Keys for State-Changing Operations | Accepted | 2026-09-14 |
| [009](./009-commercial-immutability.md) | Completed Jobs Are Financially Immutable | Accepted | 2026-09-14 |
| [010](./010-profession-skill-system.md) | Hierarchical Profession-to-Skill Model | Accepted | 2026-09-14 |

---

## ADR Template

Each ADR follows this structure:

```markdown
# ADR-NNN: Title

**Status**: Proposed | Accepted | Deprecated | Superseded by [ADR-XXX]
**Date**: YYYY-MM-DD

## Context

What is the issue that motivates this decision?

## Decision

What is the change being proposed or decided?

## Consequences

### Positive
- ...

### Negative
- ...

### Neutral
- ...
```

---

## Lifecycle

- **Proposed**: Under discussion, not yet decided.
- **Accepted**: Decision made and active.
- **Deprecated**: No longer relevant; kept for historical context.
- **Superseded**: Replaced by a newer ADR.

To propose a new ADR, create a new file following the template, assign the next sequential number, and add it to this index.
