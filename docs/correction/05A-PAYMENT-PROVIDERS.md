# 05A-PAYMENT-PROVIDERS.md — Provider Inventory

**Date**: Sep 8, 2026
**Evidence**: Code analysis, production data

---

## CURRENT PAYMENT INFRASTRUCTURE

### Payment Methods

| Method | Schema Value | Status | Production Usage |
|--------|-------------|--------|-----------------|
| Card (online) | `CARD` | ACTIVE | 10 of 11 escrows |
| Cash (in-person) | `CASH` | ACTIVE | 1 of 11 escrows |
| Wallet (top-up) | `WALLET` | DEAD (501) | 0 transactions |
| Bank transfer | `BANK_TRANSFER` | NOT IMPLEMENTED | 0 transactions |

### External Payment Providers

| Provider | Integration | Status |
|----------|-------------|--------|
| Stripe | None | Not integrated |
| PayPal | None | Not integrated |
| Dialog Genie | None | Not integrated |
| FriMi | None | Not integrated |
| Bank API | None | Not integrated |

### How CARD Payments Work

1. Customer funds escrow
2. `paymentMethod: 'CASH'` or `paymentMethod: 'CARD'` stored on JobEscrow
3. No actual payment processing — system trusts the flag
4. **No money is actually collected from customer's card**

**Critical Finding**: The `CARD` payment method is a flag, not an actual payment integration. No real card is charged. The system assumes money was deposited.

---

## PAYMENT FLOW ANALYSIS

### CARD Flow (Current)

```
Customer → "Funds Escrow" → JobEscrow.status = 'PROTECTED'
                           → CustomerWallet.balance -= amount
                           → No card charge
                           → Money appears from CustomerWallet (which was pre-loaded)
```

**Assumption**: CustomerWallet was previously loaded with real money. But wallet top-up is DEAD (501).

**Conclusion**: CARD escrows can only be funded if the customer already has a balance in CustomerWallet. The only way to get a balance is through seed data or admin adjustment.

### CASH Flow (Current)

```
Customer → "Funds Escrow" → JobEscrow.status = 'PROTECTED'
                           → NO CustomerWallet debit
                           → No real money movement
                           → Provider completes job
                           → Cash exchanged outside system
                           → Provider wallet credited
```

**Conclusion**: CASH flow creates money from nothing (provider wallet credited without customer debited).

---

## REQUIRED PAYMENT INTEGRATIONS

### Phase 5: Wallet Top-Up (Priority: P0)

| Aspect | Design |
|--------|--------|
| Provider | Dialog Genie / FriMi / Bank transfer |
| Flow | Customer → Bank API → CustomerWallet credit |
| Idempotency | Bank reference ID as idempotency key |
| Webhook | Bank sends confirmation → system credits wallet |
| Verification | Bank confirms amount before credit |

### Phase 6: Provider Payout (Priority: P1)

| Aspect | Design |
|--------|--------|
| Provider | Bank API (local Sri Lankan banks) |
| Flow | Admin approves → Bank API → Provider bank account |
| Idempotency | Payout ID as reference |
| Verification | Bank confirms transfer |
| KYC | Required before first payout |

### Phase 7: Direct Card Payment (Priority: P2)

| Aspect | Design |
|--------|--------|
| Provider | Stripe / local card processor |
| Flow | Customer card → Escrow hold → Capture on completion |
| Idempotency | Payment intent ID |
| Webhook | Payment confirmed → Escrow funded |
| Refund | Auto-refund on escrow refund |

---

## PAYMENT PROVIDER COMPARISON

### Sri Lankan Market Options

| Provider | Cards | Bank Transfer | Mobile Wallet | Fees |
|----------|-------|---------------|---------------|------|
| Dialog Genie | ✅ | ✅ | ✅ | 2.5% |
| PayHere | ✅ | ✅ | ✅ | 2.9% + LKR 20 |
| Stripe | ✅ | ✅ | ❌ | 2.9% + $0.30 |
| FriMi | ❌ | ✅ | ✅ | Free |
| Bank of Ceylon | ❌ | ✅ | ❌ | Free |

### Recommendation

| Phase | Provider | Reason |
|-------|----------|--------|
| Phase 5 (Wallet Top-Up) | FriMi + Bank transfer | Zero fees, local |
| Phase 6 (Provider Payout) | Bank API | Direct bank transfer |
| Phase 7 (Direct Card) | PayHere | Sri Lankan market leader |

---

## ESCROW PAYMENT INTEGRATION DESIGN

### CARD Flow (With Real Payment)

```
1. Customer initiates payment
2. System creates PaymentIntent with provider (PayHere/Stripe)
3. Customer enters card details on provider's hosted page
4. Provider charges card → returns confirmation
5. System creates JobEscrow (PROTECTED)
6. On job completion: capture held funds → release to provider
7. On refund: release hold → refund to customer
```

### Current vs Future

| Aspect | Current | Future |
|--------|---------|--------|
| Card charge | None (flag only) | Real payment integration |
| Wallet top-up | DEAD (501) | Bank API integration |
| Provider payout | DEAD (503) | Bank API integration |
| Escrow hold | Database flag | Payment provider hold |
| Refund | Database credit | Payment provider refund |

---

## MIGRATION PATH

### Step 1: Wallet Top-Up (Phase 5)

1. Integrate FriMi for bank transfer deposits
2. Enable wallet top-up endpoint
3. Customers deposit money via bank transfer
4. CustomerWallet.balance credited on bank confirmation

### Step 2: Provider Payout (Phase 5-6)

1. Integrate bank API for payouts
2. Enable withdrawal endpoint with KYC check
3. Admin approves withdrawal
4. Bank API transfers to provider's bank account

### Step 3: Direct Card (Phase 7)

1. Integrate PayHere for card payments
2. Replace `paymentMethod` flag with real PaymentIntent
3. Escrow funded by actual card charge
4. Refund triggers real card refund

---

## SUMMARY

| Aspect | Current Status |
|--------|---------------|
| Real card processing | ❌ Not integrated |
| Wallet top-up | ❌ DEAD (501) |
| Provider payout | ❌ DEAD (503) |
| Cash flow | ⚠️ Creates money from nothing |
| CARD flow | ⚠️ Assumes pre-loaded wallet |
| Payment providers | None integrated |
| Required integrations | 3 (deposit, payout, card) |
