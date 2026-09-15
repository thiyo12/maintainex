# ADR-005: 6-Role RBAC with Country-Scoped Isolation

**Status**: Accepted
**Date**: 2026-09-14

## Context

The admin panel serves multiple operational teams: user management handles KYC and suspensions, finance manages commissions and settlements, support resolves disputes, and technical staff monitor security. Each team needs access to specific resources without exposure to sensitive financial or user data outside their scope.

The platform operates in multiple countries (LK, CA), requiring data isolation so country-specific admins only see their region's users, jobs, and financial records.

Reference: `lib/admin-types.ts:12-99`, `lib/admin-rbac.ts`

## Decision

Implement a 6-role RBAC system with granular permission strings and country-scoped data access:

### Roles and Permissions

| Role | Scope | Key Permissions |
|------|-------|----------------|
| SUPER_ADMIN | All regions | Full access: users, jobs, finance, settings, admin management |
| MANAGER | Assigned region | Job moderation, user management, queue assignment, disputes |
| FINANCE | Assigned region | Commission config, wallet management, settlement, pricing config |
| USER_MANAGEMENT | Assigned region | KYC review, user/tasker/company suspension and banning |
| SUPPORT | Assigned region | Dispute resolution, support tickets, KYC view, job view |
| TECHNICAL | All regions | Security audit, analytics, monitoring |

### Permission Format

Permissions follow `resource:action` format:
- `users:view`, `users:edit`, `users:ban`, `users:suspend`
- `jobs:view`, `jobs:manage`, `jobs:cancel`
- `commission:view`, `commission:manage`, `commission:config`
- `security:view`, `security:audit`

### Country Scoping

Admins are assigned a `region` field. API routes filter query results by `countryCode` matching the admin's region. SUPER_ADMIN bypasses country filtering.

### Session Management

Admin sessions use JWT access + refresh tokens stored in `AdminSession` table. 2FA (TOTP) required for FINANCE and SUPER_ADMIN roles. Session invalidation on role change or suspension.

## Consequences

### Positive
- Principle of least privilege: each role sees only what it needs
- Audit trail: all admin actions logged via `writeCompanyAuditLog`
- Country isolation: finance data for LK never leaks to CA admins
- Scalable: new roles added by extending `ROLE_PERMISSIONS` map

### Negative
- Permission strings must be kept in sync across 6 roles (~40 unique permissions)
- Country scoping adds WHERE clauses to every admin query
- Role-based auto-assignment for work queue alerts adds complexity

### Neutral
- Aligns with the 5→6 role expansion in Phase 2.1
- SUPER_ADMIN retains god-mode for incident response
