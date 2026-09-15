# ADR-006: Company-to-Worker Assignment Model

**Status**: Accepted
**Date**: 2026-09-14

## Context

Companies on the marketplace win jobs through quotes but do not perform the work themselves. They dispatch individual workers (employees or subcontractors) to job sites. The platform needs to track which worker is responsible for a job, enforce that only assigned workers can start work, and prevent assignment conflicts (two workers on the same job).

The model must support both individual providers (who self-assign) and company providers (who dispatch workers), with a unified job lifecycle.

Reference: `lib/domain/company-job-assignment.ts` (326 lines)

## Decision

Implement a `CompanyJobAssignment` model with a finite state machine:

### Assignment Lifecycle

```
ASSIGNED -> ACCEPTED -> IN_PROGRESS -> COMPLETED
    |           |
    v           v
 REJECTED    REVOKED
    |
    v
 REVOKED
```

### Key Rules

1. **One active assignment per job**: A job can only have one active assignment (ASSIGNED, ACCEPTED, or IN_PROGRESS). Creating a new assignment requires revoking the existing one first.
2. **Worker uniqueness**: A worker can only have one active assignment across all jobs at a time. Prevents double-booking.
3. **Job state prerequisite**: Assignment requires job in `QUOTE_ACCEPTED` status with an accepted quote from the company.
4. **Revocation**: Company admins can revoke assignments at any active state. Revoked workers are notified and the job returns to unassigned state.
5. **Audit logging**: Every assignment state change writes to the company audit log via `writeCompanyAuditLog`.

### Actor Resolution

`resolveProviderActor` in `lib/domain/job-lifecycle.ts:14-34` determines whether a user acts as:
- `PROVIDER` — Individual tasker who owns the accepted quote
- `COMPANY` — Company member (via `TeamMember` relationship)
- `CUSTOMER` — Job poster
- `STAFF` — Admin staff
- `SYSTEM` — Automated process

## Consequences

### Positive
- Clear accountability: exactly one worker responsible per job
- Prevents double-booking: worker uniqueness constraint enforced at DB level
- Supports company scaling: companies dispatch any available worker
- Audit trail: every assignment change is logged with actor and reason

### Negative
- Adds a state machine layer on top of the job lifecycle
- Revocation requires notification to the displaced worker
- Worker availability checking adds query overhead

### Neutral
- Individual providers bypass this model entirely (they self-perform)
- Assignment model coexists with the job status machine; they are orthogonal
