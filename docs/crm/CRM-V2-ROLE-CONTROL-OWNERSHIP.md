# MaintainEX CRM V2 — Control Ownership by Staff Role

## Principles

- Roles are templates, not the only authorization source.
- Per-staff ALLOW/DENY overrides apply to delegable permissions.
- Explicit DENY wins.
- Country/market scope is independent and fail-closed.
- Owner-only permissions are non-delegable except through an explicit future governance policy.
- Staff cannot approve their own high-risk financial action.
- Staff cannot grant permissions they are not authorized to delegate.

## Role mission

### SUPER_ADMIN
Governance and exceptional authority.
Owns:
- owner/security policy
- staff governance
- high-risk finance approvals
- market/platform policy
- emergency controls
- final escalation

Should not be required for routine daily operations.

### MANAGER
Marketplace operations lead.
Owns:
- operational escalations
- jobs/workflow oversight
- provider/company assignment exceptions
- dispute escalation
- selected dual approvals
- operational configuration within delegated scope

### FINANCE
Financial operations.
Owns:
- payments
- escrow
- refunds
- wallets
- payouts
- commission
- settlements
- reconciliation

Does not own:
- staff governance
- KYC approval unless separately delegated
- platform security
- catalog publication by default

### USER_MANAGEMENT
Identity/provider/company administration.
Owns:
- customers
- taskers
- companies
- KYC
- credentials
- account status
- professions/skills approval where delegated
- trust signals tied to identity

Does not own direct money movement.

### SUPPORT
Customer/provider service.
Owns:
- support conversations
- job assistance
- dispute intake
- low-risk operational notes
- customer/provider communication
- escalation creation

May propose but not independently approve financial actions unless explicitly delegated.

### TECHNICAL
Security/technical operations.
Owns:
- security events
- failed login investigation
- blocked IPs
- system health
- integration health
- audit/security diagnostics

Does not receive broad business PII or financial mutation authority by default.

## Domain ownership matrix

| Domain / control | SUPER_ADMIN | MANAGER | FINANCE | USER_MANAGEMENT | SUPPORT | TECHNICAL |
|---|---|---|---|---|---|---|
| Dashboard | Full | Full | Finance/ops view | User/trust view | Support/ops view | Health/security view |
| Jobs | Full | Primary owner | Read/finance-linked | Read/account-linked | Support actions | Read diagnostics only |
| Job lifecycle exception | Final escalation | Primary | Finance-dependent only | Limited | Propose/escalate | No |
| Customer profiles | Full | Oversight | Read limited | Primary | Support-limited | Minimal |
| Customer suspend/reactivate | Full | Allowed if delegated | No | Primary | Escalate only | Security emergency hold only |
| Tasker/provider profiles | Full | Oversight | Read | Primary | Support-limited | Minimal |
| Tasker suspend/reactivate | Full | Allowed if delegated | No | Primary | Escalate | Security emergency hold |
| Company profiles/workforce | Full | Primary ops oversight | Read finance fields | Identity/KYC ownership | Support | Minimal |
| KYC/credentials | Final escalation | Oversight | No | Primary owner | Read limited | Security metadata only |
| Quotes | Full | Primary ops | Read financial | Read | Support | No |
| Messaging | Full | Oversight | Read where finance case requires | Read where identity case requires | Primary support | Security abuse metadata only |
| Notifications to single user | Full | Yes | Finance case | Identity case | Primary support | Security incident only |
| Mass broadcast | Final approval for high-risk | Can create/approve delegated | Finance audience only | Identity audience only | Draft/support audience | Security incident audience |
| Payments | Final escalation | Dual approver | Primary owner | Read limited | Read limited | Diagnostics only |
| Escrow | Final escalation | Dual approver | Primary owner | No | Propose/escalate | Diagnostics only |
| Refunds | Final escalation | Dual approver | Primary owner | No | Propose refund | Diagnostics |
| Payouts | Final escalation | Dual approver | Primary owner | Read KYC-related | No | Diagnostics |
| Wallet adjustments | Final escalation | Dual approver | Primary owner | No | No | No |
| Commission | Publish policy | Review | Primary ops/proposal | No | No | No |
| Settlements | Final escalation | Dual approval | Primary owner | No | No | Diagnostics |
| Disputes | Final/high-value resolution | Primary escalation | Financial effect approval | Identity evidence support | Primary intake/casework | Security evidence support |
| Risk/fraud events | Full | Operational owner | Finance risk cases | Identity risk cases | Escalate | Security owner |
| Reviews moderation | Full | Oversight | No | Primary/delegated | Support/delegated | No |
| Catalog | Publish/owner override | Primary/delegated | Pricing read | Profession/eligibility input | Read | No |
| Pricing config | Final policy | Review | Primary financial proposal | No | No | Technical validation only |
| Market config | Final publish | Operational proposal | Finance fields | Identity availability input | Read | Technical validation |
| Offers/promotions | Full | Primary/delegated | Financial validation | Eligibility input | Support visibility | No |
| Membership/subscription plans | Final policy | Product/ops proposal | Financial validation | Read | Support | Technical |
| Real estate moderation | Full | Primary/delegated | Boost/payment read | Identity support | Support | No |
| Staff directory | Full | Read/delegated management | Read own team if configured | Read own team if configured | No | Security status only |
| Role assignment | Owner-only/highly restricted | No unless explicit delegation | No | No | No | No |
| Granular permission grants | Owner-only for sensitive; delegated subset possible | Delegated subset | No | No | No | No |
| Country scope assignment | Full | Delegated subset | No | No | No | No |
| Staff session revoke | Full | Delegated team | Own/team if permitted | Own/team if permitted | Own only | Security response |
| 2FA enforcement | Full | No | No | No | No | Security workflow |
| Settings | Full | Operational delegated | Finance-specific | User/trust-specific | Support-specific | Technical-specific |
| Audit log | Full read | Read | Read relevant | Read relevant | Read relevant | Security read |
| Audit mutation/delete | No normal role | No | No | No | No | No |
| Security monitor | Full | Read | Limited | Limited | Limited | Primary owner |
| Blocked IPs | Full | No | No | No | No | Primary owner |
| System health | Full | Read | Integration health | Read | Read limited | Primary owner |

## Separation-of-duties examples

### Refund
- SUPPORT can open/request a refund.
- FINANCE validates and initiates.
- MANAGER/SUPER_ADMIN approves when threshold requires.
- Same staff member cannot initiate and approve T2+.

### KYC + payout
- USER_MANAGEMENT approves identity.
- FINANCE handles payout.
- A single compromised KYC operator cannot send money.

### Staff privilege
- MANAGER may manage operational assignments.
- Only SUPER_ADMIN can grant sensitive staff/security/finance-governance capabilities.

### Security incident
- TECHNICAL can block IP/revoke security sessions where allowed.
- TECHNICAL does not gain arbitrary refund/payout capabilities from that role.

## Delegation model

Permissions are tagged:
- OWNER_ONLY
- DELEGABLE_SENSITIVE
- DELEGABLE_NORMAL
- READ_ONLY

SUPER_ADMIN may delegate only permissions marked delegable.
The system rejects any attempt to assign OWNER_ONLY permissions to another role unless a future explicit governance mechanism is added.
