# MaintainEX CRM V2 — High-Risk Exception Rules

## Outcomes

Risk rules return one of:
- ALLOW
- ESCALATE +1/+2
- T3_MINIMUM
- T4_REQUIRED
- HOLD
- PROHIBIT

Rules run at request time and again immediately before execution.

## Financial exceptions

| Trigger | Result |
|---|---|
| Active dispute on escrowed job | HOLD release |
| Fraud/security hold on payer/recipient/provider/company | HOLD money movement |
| Recipient KYC expired/rejected/under review | HOLD payout |
| Payout destination changed within 72h | T4 or cooling hold |
| First payout above LKR 100,000 | minimum T3 |
| Aggregate recipient/staff velocity crosses higher tier | escalate using aggregate |
| Apparent threshold splitting | aggregate tier + security event |
| Currency mismatch | HOLD |
| Country/recipient mismatch | HOLD |
| Refund > remaining refundable amount | PROHIBIT |
| Duplicate financial idempotency key | no duplicate execution |
| Manual refund after escrow/payout release | minimum T3 |
| Manual escrow release | minimum T2 |
| Active chargeback/conflicting provider dispute | HOLD |
| Recent identity/KYC change before payout | minimum T3 / hold |
| Unexpected third-party payout destination | HOLD |
| >3 denied/failed approval attempts in 30m | HOLD + security event |
| Gateway result uncertain | reconciliation HOLD |

## Job/lifecycle exceptions

| Trigger | Result |
|---|---|
| Skip required start PIN | PROHIBIT direct override |
| Mark arrival without evidence | formal exception only |
| In-progress cancellation with money impact | Manager + Finance review |
| Completion with active dispute | HOLD conflicting release |
| Provider suspended during active job | Manager escalation |
| Identity mismatch | HOLD |
| Cross-country reassignment | PROHIBIT without canonical migration |
| Amount changed outside quote/change-order service | PROHIBIT |

## Staff/security exceptions

| Trigger | Result |
|---|---|
| Self-role promotion | PROHIBIT |
| Self-permission expansion | PROHIBIT |
| Remove own DENY | PROHIBIT |
| Non-owner grants OWNER_ONLY | PROHIBIT |
| Create SUPER_ADMIN | owner-only + step-up + audit |
| Disable/delete last active SUPER_ADMIN | PROHIBIT |
| Sensitive role/scope/security change | step-up + session invalidation |
| Disabled/deleted staff with valid old JWT | DENY via live DB |
| Required TOTP missing | HOLD sensitive actions |
| Repeated denied privileged API calls | security event + possible revoke |

## Data/privacy exceptions

| Trigger | Result |
|---|---|
| Export <=1,000 low-sensitivity scoped rows | export permission |
| Export 1,001-10,000 rows | Manager approval |
| Export >10,000 or sensitive PII | senior/owner controlled export |
| Raw KYC/security secrets export | PROHIBIT normal export |
| Private file outside authorized case/scope | PROHIBIT |
| Internal note/risk reason sent to public API | PROHIBIT |
| Cross-market enumeration attempt | DENY + security event |
| Raw password/token/TOTP/payment secret request | PROHIBIT |

## Broadcast exceptions

| Trigger | Result |
|---|---|
| Single-user operational message | normal permission |
| Audience >1,000 | preview + step-up |
| Audience >10,000 | dual approval |
| Entire market/all users | T4-equivalent approval |
| Sensitive PII in message | PROHIBIT until sanitized |
| Duplicate broadcast key | no duplicate send |

## Catalog/platform exceptions

| Trigger | Result |
|---|---|
| Publish incomplete service | PROHIBIT |
| Enable unsupported market/currency/runtime | PROHIBIT |
| Retroactive pricing/commission rewrite | PROHIBIT without explicit migration |
| Disable whole market/channel | step-up + confirmation + audit |
| Maintenance/global booking stop | step-up + reason + audit |
| Runtime does not consume setting | control must not exist |

## Break-glass policy

Break-glass can:
- freeze
- pause
- revoke
- block
- disable
- quarantine

Break-glass cannot:
- pay
- release money
- mark paid
- approve KYC without evidence
- delete ledger/audit
- elevate hidden privileges
- bypass market/object authorization

Every break-glass action creates a CRITICAL security audit event.
