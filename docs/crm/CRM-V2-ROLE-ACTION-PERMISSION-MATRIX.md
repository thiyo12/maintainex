# MaintainEX CRM V2 — Role-by-Action Permission Matrix

## Authorization rule

Effective permission is calculated from live account/session state, role template, explicit per-staff DENY/ALLOW, country/market scope, object authorization, approval tier, and step-up requirements. UI visibility is never authority.

Permission classes:
- OWNER_ONLY
- SENSITIVE
- NORMAL
- READ
- SYSTEM_ONLY

Legend: O=owner/final authority, P=primary operator, A=approver/reviewer, R=read, E=escalate/request, —=no default access.

| Action | Permission | Class | SUPER_ADMIN | MANAGER | FINANCE | USER_MANAGEMENT | SUPPORT | TECHNICAL |
|---|---|---|---|---|---|---|---|---|
| View dashboard | dashboard:view | READ | O | P | R | R | R | R |
| View jobs | jobs:view | READ | O | P | R | R | R | R-limited |
| Reschedule job | jobs:reschedule | NORMAL | O | P | — | — | E | — |
| Reassign provider/company | jobs:assign | SENSITIVE | O | P | — | R | E | — |
| Cancel unstarted job | jobs:cancel | SENSITIVE | O | P | A if refund | — | E | — |
| Approve lifecycle exception | jobs:exception:approve | SENSITIVE | O | P/A | A-finance | — | E | — |
| View/rotate PIN state | jobs:verification:manage | SENSITIVE | O | P | — | — | E | — |
| Manage inspections/evidence | jobs:evidence:manage | SENSITIVE | O | P | R-case | P-identity | E | quarantine |
| View customers | customers:view | READ | O | P | R-limited | P | P-limited | minimal |
| Edit customer | customers:edit | NORMAL | O | A | — | P | E | — |
| Suspend/reactivate customer | customers:status:manage | SENSITIVE | O | A | — | P | E | emergency hold |
| View taskers | taskers:view | READ | O | P | R | P | P-limited | minimal |
| Edit tasker | taskers:edit | NORMAL | O | A | — | P | E | — |
| Suspend/reactivate tasker | taskers:status:manage | SENSITIVE | O | A | — | P | E | emergency hold |
| Manage professions/skills | taskers:skills:manage | NORMAL | O | A | — | P | — | — |
| View companies | companies:view | READ | O | P | R | P | P-limited | minimal |
| Manage workforce | companies:workforce:manage | SENSITIVE | O | P | — | R | E | — |
| Suspend/reactivate company | companies:status:manage | SENSITIVE | O | A | — | P | E | emergency hold |
| Review KYC | kyc:review | READ/SENSITIVE | O | A | R-payout | P | R-limited | security metadata |
| Approve/reject KYC | kyc:manage | SENSITIVE | O | A | — | P | — | — |
| Manage credentials | credentials:manage | SENSITIVE | O | A | — | P | — | — |
| View quotes | quotes:view | READ | O | P | R | R | R | — |
| Invalidate fraudulent quote | quotes:invalidate | SENSITIVE | O | P | — | — | E | — |
| View messages | messages:view | READ | O | P | case-only | case-only | P | abuse metadata |
| Support reply | messages:respond | NORMAL | O | P | case-only | case-only | P | — |
| Moderate attachment | messages:moderate | SENSITIVE | O | P | — | A | P | quarantine |
| Send single notification | notifications:send | NORMAL | O | P | finance-case | identity-case | P | security-case |
| Create broadcast | notifications:broadcast:create | SENSITIVE | O | P | scoped | scoped | scoped | scoped |
| Approve large broadcast | notifications:broadcast:approve | SENSITIVE | O | A-delegated | — | — | — | security-only |
| View payments | finance:payments:view | READ | O | R | P | — | R-limited | diagnostics |
| Reconcile payment | finance:payments:reconcile | SENSITIVE | O | A | P | — | E | diagnostics |
| Initiate refund | finance:refund:initiate | SENSITIVE | O | A | P | — | E | — |
| Approve refund | finance:refund:approve | SENSITIVE | O | A | A-independent | — | — | — |
| View escrow | finance:escrow:view | READ | O | R | P | — | R-limited | diagnostics |
| Initiate manual escrow release | finance:escrow:release:initiate | SENSITIVE | O | A | P | — | E | — |
| Approve manual escrow release | finance:escrow:release:approve | SENSITIVE | O | A | A-independent | — | — | — |
| View wallets | finance:wallets:view | READ | O | R | P | — | R-limited | diagnostics |
| Freeze/unfreeze wallet | finance:wallets:freeze | SENSITIVE | O | A | P | — | E | emergency hold |
| Initiate ledger correction | finance:wallets:adjust:initiate | SENSITIVE | O | A | P | — | — | — |
| Approve ledger correction | finance:wallets:adjust:approve | SENSITIVE | O | A | A-independent | — | — | — |
| View payouts | finance:payouts:view | READ | O | R | P | R-KYC | — | diagnostics |
| Initiate payout | finance:payouts:initiate | SENSITIVE | O | A | P | — | — | — |
| Approve payout | finance:payouts:approve | SENSITIVE | O | A | A-independent | — | — | — |
| Manage payout destination | finance:payout-destination:manage | SENSITIVE | O | A | P-verified | identity support | — | — |
| Propose commission policy | finance:commission:propose | SENSITIVE | O | A | P | — | — | — |
| Publish commission policy | finance:commission:publish | OWNER_ONLY | O | — | — | — | — | — |
| Initiate settlement | finance:settlements:initiate | SENSITIVE | O | A | P | — | — | — |
| Approve settlement | finance:settlements:approve | SENSITIVE | O | A | A-independent | — | — | — |
| View disputes | disputes:view | READ | O | P | R | R | P | security evidence |
| Open/assign dispute | disputes:manage | NORMAL | O | P | — | — | P | — |
| Resolve non-financial dispute | disputes:resolve | SENSITIVE | O | P | — | A-identity | P-delegated | — |
| Approve dispute financial effect | disputes:finance:approve | SENSITIVE | O | A | P/A-tiered | — | E | — |
| View risk events | risk:view | READ | O | P | finance | identity | R | P |
| Resolve risk | risk:resolve | SENSITIVE | O | P | finance-case | identity-case | E | P-security |
| Moderate reviews | reviews:moderate | SENSITIVE | O | A | — | P | P-delegated | — |
| View/edit catalog drafts | catalog:edit | NORMAL | O | P | pricing proposal | eligibility input | R | — |
| Publish catalog | catalog:publish | SENSITIVE | O | P/A | pricing validation | eligibility validation | — | — |
| Manage pricing config | pricing:manage | SENSITIVE | O | A | P | — | — | validation |
| Publish pricing policy | pricing:publish | OWNER_ONLY/SENSITIVE | O | A-delegated | proposal | — | — | validation |
| Manage market config | markets:manage | SENSITIVE | O | P | finance fields | identity input | R | validation |
| Publish/disable market | markets:publish | OWNER_ONLY/SENSITIVE | O | A-delegated | — | — | — | — |
| Manage promotions | promotions:manage | NORMAL | O | P | finance validation | eligibility | R | — |
| View real estate | realestate:view | READ | O | P | R-boost/payment | R-identity | R | — |
| Moderate/feature real estate | realestate:manage | SENSITIVE | O | P | — | — | E | — |
| View staff | staff:view | READ | O | R | self/team | self/team | self | security status |
| Create staff | staff:create | OWNER_ONLY/SENSITIVE | O | delegated non-sensitive only | — | — | — | — |
| Assign role | staff:role:manage | OWNER_ONLY | O | — | — | — | — | — |
| Manage granular permissions | staff:permissions:manage | OWNER_ONLY | O | NORMAL subset only if delegated | — | — | — | — |
| Manage country scope | staff:scope:manage | OWNER_ONLY/SENSITIVE | O | delegated subset | — | — | — | — |
| Revoke staff session | staff:sessions:revoke | SENSITIVE | O | team-delegated | own/team-explicit | own/team-explicit | own | P-security |
| Reset staff password | staff:password:reset | OWNER_ONLY/SENSITIVE | O | team-delegated only | — | — | — | security-assisted |
| Manage privileged 2FA | staff:2fa:manage | OWNER_ONLY/SENSITIVE | O | — | — | — | — | P-process |
| View audit | audit:view | READ | O | P | relevant | relevant | relevant | P |
| Modify/delete audit | audit:mutate | SYSTEM_ONLY | — | — | — | — | — | — |
| View security monitor | security:view | READ | O | R | limited | limited | limited | P |
| Block/unblock IP | security:ip-block:manage | SENSITIVE | O | — | — | — | — | P |
| Resolve security event | security:events:manage | SENSITIVE | O | A | — | identity case | E | P |
| View system health | health:view | READ | O | R | integration subset | R | R | P |
| Modify infrastructure | infrastructure:manage | DEPLOYMENT/OPS | — | — | — | — | — | — |

## Non-negotiable self-control rules

A staff member cannot:
- promote themselves
- expand their own permissions
- remove their own DENY
- expand their own market scope
- approve their own T2/T3/T4 action
- disable their own mandatory security requirement
- edit/delete their audit trail
