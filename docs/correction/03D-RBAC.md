# 03D — RBAC Model

## AdminUser Roles

| Role | Description |
|------|-------------|
| SUPER_ADMIN | Full platform access, can reassign work queue |
| MANAGER | Full read, reassign work, resolve escalations, manage work queue |
| FINANCE | Commission, wallets & settlements |
| USER_MANAGEMENT | KYC review, user suspension & ban |
| SUPPORT | Disputes, complaints & user tickets |
| TECHNICAL | Security audit, system health & error logs |

## Permission Matrix

| Permission | SUPER_ADMIN | MANAGER | FINANCE | USER_MANAGEMENT | SUPPORT | TECHNICAL |
|------------|:-----------:|:-------:|:-------:|:---------------:|:-------:|:---------:|
| dashboard:view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| users:view | ✓ | ✓ | ✓ | ✓ | ✓ | |
| users:edit | ✓ | ✓ | | ✓ | | |
| users:ban | ✓ | | | ✓ | | |
| users:suspend | ✓ | | | ✓ | | |
| taskers:view | ✓ | ✓ | ✓ | ✓ | ✓ | |
| taskers:edit | ✓ | ✓ | | ✓ | | |
| taskers:verify | ✓ | ✓ | | ✓ | | |
| companies:view | ✓ | ✓ | ✓ | ✓ | ✓ | |
| companies:edit | ✓ | ✓ | | ✓ | | |
| kyc:view | ✓ | | | ✓ | ✓ | |
| kyc:approve | ✓ | | | ✓ | | |
| jobs:view | ✓ | ✓ | | | | |
| jobs:manage | ✓ | ✓ | | | | |
| commission:view | ✓ | ✓ | ✓ | | | |
| commission:manage | ✓ | ✓ | ✓ | | | |
| wallets:view | ✓ | | ✓ | | | |
| wallets:manage | ✓ | | ✓ | | | |
| disputes:view | ✓ | ✓ | | | ✓ | |
| disputes:resolve | ✓ | ✓ | | | ✓ | |
| analytics:view | ✓ | ✓ | ✓ | | | ✓ |
| admins:view | ✓ | | | | | |
| admins:create | ✓ | | | | | |
| settings:view | ✓ | | | | | |
| security:view | ✓ | | | | | ✓ |
| security:audit | ✓ | | | | | ✓ |

## Authoritative RBAC Flow

```
StaffPrincipal (adminUserId, sessionId)
  ↓
AdminUser lookup (current DB state)
  ↓
current role → ROLE_PERMISSIONS[role]
  ↓
current assignedCountries
  ↓
resource authorization
```

**Rule**: Authorization ALWAYS uses current DB state. JWT claims do NOT carry role/permissions.
