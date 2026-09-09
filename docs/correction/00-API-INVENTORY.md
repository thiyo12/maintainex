# MaintainEX API Route Inventory

## Summary

- **Total route files**: ~192
- **Authenticated routes**: ~155
- **Public routes**: ~37
- **Admin role-gated routes**: ~30
- **Ownership-checked routes**: ~15
- **Financial mutation routes**: ~16
- **Cron job routes**: 9
- **File upload routes**: 4
- **Internal/secret routes**: 2

## Auth Systems Used

| System | Function | Used By |
|---|---|---|
| Mobile JWT | `authenticateRequest()` from `lib/mobile-auth.ts` | 60+ mobile routes |
| Admin New JWT | `getAdminSession()` from `lib/admin-auth.ts` | 16 admin routes |
| Admin Legacy | `getSession()` from `lib/auth-utils.ts` | 50 legacy routes |
| Cron Bearer | `Bearer ${CRON_SECRET}` | 9 cron routes |
| Internal Header | `x-internal-sync` | 2 internal routes |

## Routes by Domain

### Mobile Auth (9 routes)
- POST `/api/mobile/auth/login` — Password login
- POST `/api/mobile/auth/register` — OTP-only registration
- GET `/api/mobile/auth/me` — Current user
- PUT `/api/mobile/auth/profile` — Profile update
- POST `/api/mobile/auth/send-otp` — Send OTP
- POST `/api/mobile/auth/verify-otp` — Verify OTP
- POST `/api/mobile/auth/otp-login` — OTP login
- POST `/api/mobile/auth/forgot-password` — Password reset OTP
- POST `/api/mobile/auth/reset-password` — Reset password

### Mobile Jobs V2 (24 routes)
- POST `/api/mobile/v2/jobs` — Create job
- GET `/api/mobile/v2/jobs` — List jobs
- GET `/api/mobile/v2/jobs/[id]` — Job detail
- POST `/api/mobile/v2/jobs/[id]/select-quote` — Accept quote
- POST `/api/mobile/v2/jobs/[id]/escrow` — Deposit escrow
- POST `/api/mobile/v2/jobs/[id]/release-escrow` — Release escrow
- POST `/api/mobile/v2/jobs/[id]/escrow/refund` — Refund escrow
- POST `/api/mobile/v2/jobs/[id]/cash-payment` — Cash payment
- POST `/api/mobile/v2/jobs/[id]/complete` — Completion flow
- GET/POST `/api/mobile/v2/jobs/[id]/reviews` — Reviews
- POST `/api/mobile/v2/jobs/[id]/otp` — Generate OTP
- POST `/api/mobile/v2/jobs/[id]/otp/verify` — Verify OTP
- GET/PUT `/api/mobile/v2/jobs/[id]/workspace` — Workspace
- POST `/api/mobile/v2/jobs/[id]/share-address` — Share address
- POST `/api/mobile/v2/quotes` — Submit quote
- GET `/api/mobile/v2/pricing/estimate` — AI price estimation
- POST `/api/mobile/v2/pricing/confirm` — Confirm pricing
- POST `/api/mobile/v2/pricing/materials` — Materials pricing
- POST `/api/mobile/v2/custom-jobs` — Custom job requests
- GET `/api/mobile/v2/locations` — Location tree
- GET `/api/mobile/v2/search` — Search
- GET `/api/mobile/v2/quality` — Quality scores
- GET `/api/mobile/v2/trust` — Trust scores
- GET `/api/mobile/v2/identity` — KYC identity

### Mobile Wallet (4 routes)
- GET/POST `/api/mobile/v2/wallet` — Wallet operations
- POST `/api/mobile/withdraw` — Withdrawal request
- GET `/api/mobile/earnings` — Earnings history
- GET `/api/mobile/company/earnings` — Company earnings

### Cron Jobs (9 routes)
- GET `/api/cron/escrow-release` — Auto-release escrow
- GET `/api/cron/daily-maintenance` — Daily cleanup
- GET `/api/cron/offer-timeouts` — Offer expiry
- GET `/api/cron/matching-waves` — Wave escalation
- GET `/api/cron/pricing-train` — ML training
- GET `/api/cron/reputation` — Reputation recalc
- GET `/api/cron/learn` — Learning cycle
- GET `/api/cron/job-response-escalation` — Escalation
- GET `/api/cron/re-engagement` — Re-engagement

### Admin Routes (28 routes)
- Auth: login, logout, refresh, me, 2fa/setup, 2fa/verify
- Users: users, admins, staff/activity
- Financial: wallets, commission, commission/payments
- Jobs: jobs, disputes, cheating
- KYC: kyc
- Security: failed-logins, monitor, blocked-ips, logs
- Analytics: analytics, settings, wishlist
- Dashboard: dashboard

### Public/Utility Routes
- GET `/api/health` — Health check
- POST `/api/waitlist` — Waitlist signup
- POST `/api/contact` — Contact form (does NOT save to DB)
- GET/PUT `/api/settings` — Platform settings

## Flagged Security Concerns

### Routes WITHOUT Authentication
- POST `/api/reviews` — Creates reviews without auth
- POST `/api/flash-offers/claim` — Increments claim counter without auth
- POST `/api/upload/cv` — Uploads files without auth
- GET `/api/files/[...path]` — Serves files without auth (PATH TRAVERSAL)
- POST `/api/mobile/cleanup-photos` — No auth found

### Routes with Financial Effects
- POST `/api/mobile/v2/jobs/[id]/escrow` — Wallet debit
- POST `/api/mobile/v2/jobs/[id]/release-escrow` — Wallet credit
- POST `/api/mobile/v2/jobs/[id]/escrow/refund` — Wallet credit
- POST `/api/mobile/v2/jobs/[id]/cash-payment` — Wallet credit
- POST `/api/mobile/v2/jobs/[id]/complete` — Escrow release on approval
- POST `/api/mobile/v2/wallet` — Wallet withdrawal
- POST `/api/mobile/withdraw` — Payout request
- POST `/api/properties/[id]/boost` — Wallet debit
- PATCH `/api/mobile/v2/admin/escrows` — Admin force-release/refund
- POST `/api/mobile/v2/admin/commission-settle` — Commission settlement
- PATCH `/api/admin/financial/wallets` — Freeze/unfreeze wallets
- PATCH `/api/admin/financial/commission` — Mark paid, suspend users
- POST/PUT `/api/admin/commission` — Create/update settlements
- PATCH `/api/admin/commission/payments` — Confirm payments
- GET `/api/cron/escrow-release` — Auto-release (FINANCIAL)
- GET `/api/cron/daily-maintenance` — Cancel stale escrows (FINANCIAL)
