# Phase 1B — Withdrawal Lifecycle

## Current State: DISABLED (503)

The withdrawal route has been disabled because:
1. Balance is deducted at request creation
2. No admin rejection/reversal flow exists
3. Daily maintenance cron fails stale payouts without crediting back
4. Money is permanently lost on REJECTED/FAILED payouts

## Full Lifecycle Trace

### WITHDRAW REQUEST
- `POST /api/mobile/withdraw` — creates Payout with status PENDING
- **Phase 1 (original):** Deducted from `availableBalance` atomically
- **Phase 1B (current):** Returns 503 — route disabled

### BALANCE DEDUCTION / RESERVATION
- **Phase 1:** Permanent deduction (no reservation concept)
- **Phase 1B:** N/A — disabled

### PAYOUT RECORD
- Created with status `PENDING`

### ADMIN APPROVAL
- **No admin payout API exists.** The only payout-related code is:
  - `POST /api/mobile/withdraw` — creates payout
  - `GET /api/cron/daily-maintenance` — auto-fails stale payouts

### EXTERNAL PAYMENT
- Not implemented

### REJECTION / CANCELLATION / FAILURE
- Daily maintenance cron sets `status: 'FAILED'` for payouts stuck in PROCESSING >48h
- **No wallet credit-back occurs**

## Invariant Violation

When payout is REJECTED or FAILED:
- `ProviderWallet.availableBalance` is permanently reduced
- No `WalletTransaction` credit record is created
- Provider loses funds with no recourse

## Decision

Disabled withdrawal creation (503) until the financial redesign phase adds:
- Admin payout approval/rejection API
- Reversal credit-back on rejection/failure
- Proper reservation/debit lifecycle

## Tests Added

`tests/phase1/withdrawal-safety.test.ts` — 4 tests covering:
- Exceeds balance → reject
- Within balance → accept
- Zero amount → reject
- Negative amount → reject
