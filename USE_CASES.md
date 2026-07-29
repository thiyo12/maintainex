# MaintainEX — Use Cases & Acceptance Criteria

## PHASE 1: DATABASE + ADMIN PANEL

---

### UC-01: Unique ID System

**Description:** Every user, tasker, and company gets a unique MX ID for identification.

**Use Cases:**
- UC-01.1: New user registers → system generates `MXU-XXXXX` (e.g., MXU-00123)
- UC-01.2: New tasker registers → system generates `MXT-XXXXX` (e.g., MXT-00045)
- UC-01.3: New company registers → system generates `MXC-XXXXX` (e.g., MXC-00012)
- UC-01.4: Admin can search any user/tasker/company by MX ID
- UC-01.5: MX ID is shown in admin dashboard, user profile, tasker profile, company profile
- UC-01.6: MX ID cannot be changed after creation

**Acceptance Criteria:**
- [ ] User model has `mxId` field (unique, auto-generated)
- [ ] TaskerProfile model has `mxId` field
- [ ] CompanyProfile model has `mxId` field
- [ ] Admin can search by MX ID in all management pages
- [ ] MX ID format: `MXU-` + 5 digit number, `MXT-` + 5 digit number, `MXC-` + 5 digit number

---

### UC-02: Tasker Registration & Verification

**Description:** Taskers must submit proof of experience/certification and wait for admin verification before getting orders.

**Use Cases:**
- UC-02.1: Tasker registers with mobile + name only
- UC-02.2: Tasker uploads experience proof (certificate, portfolio, previous work photos)
- UC-02.3: Tasker uploads ID document (passport or national ID)
- UC-02.4: If job involves driving → tasker must upload driving license
- UC-02.5: Admin reviews submitted documents → approves or rejects with reason
- UC-02.6: Tasker CANNOT receive job offers until KYC is approved
- UC-02.7: Tasker sees "Pending Verification" status in their profile
- UC-02.8: Admin can see all pending verifications in queue

**Acceptance Criteria:**
- [ ] TaskerProfile has `verificationStatus` (PENDING, VERIFIED, REJECTED)
- [ ] IdentityDocument model supports: PASSPORT, NATIONAL_ID, DRIVERS_LICENSE, EXPERIENCE_CERT
- [ ] Admin KYC page shows pending verifications with document previews
- [ ] Admin can approve/reject with reason
- [ ] Tasker cannot accept jobs if verificationStatus != VERIFIED
- [ ] Tasker profile shows verification status badge

---

### UC-03: Company Registration

**Description:** Companies must provide business proof, minimum 3 staff, and company documentation.

**Use Cases:**
- UC-03.1: Company registers with business name + registration number
- UC-03.2: Company must upload business registration document
- UC-03.3: Company must have minimum 3 staff members
- UC-03.4: Company must add all staff members with names
- UC-03.5: Company must show staff count, experience, previous jobs
- UC-03.6: Admin verifies company documents and staff count
- UC-03.7: Company CANNOT receive jobs until verified
- UC-03.8: Staff count determines job assignment capability (e.g., 40M construction job needs enough staff)

**Acceptance Criteria:**
- [ ] CompanyProfile has `minStaffCount` (default 3), `staffCount`, `staffProofUrl`
- [ ] CompanyProfile has `businessRegNumber`, `businessRegDocUrl`
- [ ] CompanyProfile has `verificationStatus` (PENDING, VERIFIED, REJECTED)
- [ ] Admin can verify company documents and staff count
- [ ] Company cannot accept jobs if verificationStatus != VERIFIED
- [ ] Job assignment checks company staff count vs job requirements

---

### UC-04: Commission System (10%)

**Description:** Platform charges 10% commission on every completed job. Commission covers legal protection and scam support.

**Use Cases:**
- UC-04.1: Job completed → 10% commission calculated automatically
- UC-04.2: Commission amount = job amount × 10%
- UC-04.3: Commission is deducted from provider's earnings
- UC-04.4: For cash jobs: provider must pay commission weekly (every Monday)
- UC-04.5: For card jobs: commission auto-deducted from card payment
- UC-04.6: Provider wallet shows: total earned, commission owed, available balance
- UC-04.7: If provider doesn't pay commission → account suspended
- UC-04.8: Admin can see all commission settlements and overdue payments

**Acceptance Criteria:**
- [ ] CommissionSettlement model tracks: jobId, providerId, amount, rate, status
- [ ] Commission rate is configurable in PlatformSettings (default 10%)
- [ ] Wallet shows commission breakdown
- [ ] Weekly settlement cron job runs every Monday
- [ ] Overdue accounts get flagged in admin
- [ ] Suspended providers cannot receive new jobs

---

### UC-05: Weekly Payment Settlement

**Description:** Every Monday, providers must pay their commission. If unpaid, account is suspended.

**Use Cases:**
- UC-05.1: System calculates weekly commission for each provider every Monday
- UC-05.2: Provider receives notification to pay commission
- UC-05.3: Provider has 7 days to pay (until next Monday)
- UC-05.4: If not paid → account suspended → no new jobs
- UC-05.5: Admin can see all weekly settlements and their status
- UC-05.6: Admin can manually override suspension if needed
- UC-05.7: Payment history tracked for each provider

**Acceptance Criteria:**
- [ ] WeeklySettlement model: providerId, weekStart, weekEnd, totalEarnings, commissionOwed, status, paidAt
- [ ] Cron job runs every Monday to generate settlements
- [ ] Provider notification sent for pending settlements
- [ ] Auto-suspend after 7 days overdue
- [ ] Admin dashboard shows weekly settlement overview

---

### UC-06: Anti-Cheat System (Off-Platform Deals)

**Description:** If providers do deals outside the app, they get banned. Users who bypass the app get no support.

**Use Cases:**
- UC-06.1: User reports provider for off-platform deal
- UC-06.2: Report includes evidence (photos, messages, etc.)
- UC-06.3: Admin reviews report → confirms or dismisses
- UC-06.4: If confirmed → provider BANNED permanently
- UC-06.5: If user does deal outside app → we don't take care of them (no ban, just no support)
- UC-06.6: Admin can see all cheating reports and their status

**Acceptance Criteria:**
- [ ] OffPlatformDeal report model: reporterId, againstUserId, evidence, status, action
- [ ] Admin can review reports with evidence
- [ ] Confirmed cases → provider banned (isBanned = true)
- [ ] User cases → flagged but not banned (just no support)
- [ ] Admin dashboard shows cheating reports

---

### UC-07: Wallet System

**Description:** Every provider has a wallet showing earnings, pending commission, and available balance.

**Use Cases:**
- UC-07.1: Provider wallet created on registration
- UC-07.2: Earnings credited after job completion
- UC-07.3: Commission deducted from earnings
- UC-07.4: Available balance = earnings - pending commission
- UC-07.5: Provider can withdraw available balance
- UC-07.6: Wallet shows transaction history
- UC-07.7: Wallet can be frozen by admin

**Acceptance Criteria:**
- [ ] ProviderWallet has: totalEarned, pendingCommission, availableBalance, isFrozen
- [ ] WalletTransaction tracks all credits and debits
- [ ] Withdrawal requests go through admin approval
- [ ] Admin can freeze/unfreeze wallets

---

### UC-08: Card Payment Commission Capture

**Description:** If provider doesn't pay commission from cash jobs, platform can take it from card payment.

**Use Cases:**
- UC-08.1: Customer pays by card → payment held in escrow
- UC-08.2: Provider doesn't pay commission → platform takes it from card payment
- UC-08.3: Remaining amount released to provider
- UC-08.4: If provider pays commission manually → full amount released
- UC-08.5: Admin can see all card payment captures

**Acceptance Criteria:**
- [ ] JobEscrow tracks: paymentMethod (CARD/CASH), commissionCaptured
- [ ] Auto-capture logic: if commission not paid within 7 days and payment was CARD → auto-deduct
- [ ] Admin can see all auto-captures

---

### UC-09: Dispute Resolution

**Description:** Customers and providers can raise disputes. Admin resolves them.

**Use Cases:**
- UC-09.1: Customer raises dispute on job
- UC-09.2: Provider raises dispute on job
- UC-09.3: Dispute includes reason and evidence
- UC-09.4: Admin reviews → resolves or dismisses
- UC-09.5: Resolution may include refund, partial refund, or no action
- UC-09.6: Admin can see all open disputes

**Acceptance Criteria:**
- [ ] Dispute model supports both customer and provider disputes
- [ ] Admin dispute resolution page
- [ ] Resolution tracking (refund amount, reason)
- [ ] Dispute status: OPEN, UNDER_REVIEW, RESOLVED, DISMISSED

---

### UC-10: Website Wishlist Management

**Description:** Admin can manage website feature requests/wishlist items.

**Use Cases:**
- UC-10.1: User submits feature request on website
- UC-10.2: Admin sees all wishlist items in admin panel
- UC-10.3: Admin can prioritize, assign, mark as planned/in-progress/completed
- UC-10.4: Admin can add internal notes
- UC-10.5: Wishlist items have status: NEW, PLANNED, IN_PROGRESS, COMPLETED, REJECTED

**Acceptance Criteria:**
- [ ] WishlistItem model: title, description, status, priority, assignedTo, notes
- [ ] Admin wishlist management page
- [ ] API endpoints for CRUD operations
- [ ] Status workflow with admin actions

---

### UC-11: Admin Unified Dashboard

**Description:** Single admin panel manages both web and app.

**Use Cases:**
- UC-11.1: Dashboard shows web + app combined metrics
- UC-11.2: Real-time job activity feed
- UC-11.3: Revenue tracking (web + app)
- UC-11.4: Commission collected this week
- UC-11.5: Active disputes count
- UC-11.6: Pending KYC verifications count
- UC-11.7: Suspended accounts count
- UC-11.8: Weekly settlement overview

**Acceptance Criteria:**
- [ ] Dashboard shows all key metrics
- [ ] Real-time updates (or near-real-time)
- [ ] Quick actions for common admin tasks
- [ ] Navigation to all admin sections

---

### UC-12: Company ID System

**Description:** Companies need identity card number and company own ID.

**Use Cases:**
- UC-12.1: Company gets MXC-XXXXX ID on registration
- UC-12.2: Company must provide business registration number
- UC-12.3: Company must provide tax ID number
- UC-12.4: Company ID shown in all company interactions
- UC-12.5: Admin can search companies by MXC ID or business reg number

**Acceptance Criteria:**
- [ ] CompanyProfile has `businessRegNumber`, `taxId`, `mxId`
- [ ] Admin can search by any of these identifiers
- [ ] Company ID visible in job assignments and invoices

---

## IMPLEMENTATION ORDER

1. **UC-01** (Unique IDs) — Foundation
2. **UC-02** (Tasker Verification) — Critical for trust
3. **UC-03** (Company Registration) — Critical for trust
4. **UC-04** (Commission System) — Revenue
5. **UC-05** (Weekly Settlement) — Revenue enforcement
6. **UC-06** (Anti-Cheat) — Trust & safety
7. **UC-07** (Wallet System) — Payment infrastructure
8. **UC-08** (Card Payment Capture) — Revenue protection
9. **UC-09** (Disputes) — Customer protection
10. **UC-10** (Website Wishlist) — Product management
11. **UC-11** (Unified Dashboard) — Admin efficiency
12. **UC-12** (Company ID) — Identification

---

## VERIFICATION CHECKLIST

After each UC is implemented, verify:
- [ ] Database schema updated
- [ ] API endpoints created
- [ ] Admin page built
- [ ] Mobile app updated (if applicable)
- [ ] All use cases pass
- [ ] No existing functionality broken
- [ ] Tests pass
- [ ] Deployed to VPS
