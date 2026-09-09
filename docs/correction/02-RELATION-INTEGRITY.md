# MaintainEX Foreign Key / Relation Integrity Audit

## Active V2 Relationships

### JobEscrow

| Relation | FK | On Delete | On Update | Risk |
|---|---|---|---|---|
| JobEscrow → MarketplaceJob | `jobId` | Cascade | Cascade | LOW — Job deletion cascades to escrow |
| JobEscrow → User | `customerId` | Restrict | Cascade | LOW — Cannot delete customer with escrow |
| JobEscrow → User | `providerId` | Restrict | Cascade | LOW — Cannot delete provider with escrow |

**Assessment:** Correct. Escrow should not exist without its job.

### JobQuote

| Relation | FK | On Delete | On Update | Risk |
|---|---|---|---|---|
| JobQuote → MarketplaceJob | `jobId` | Cascade | Cascade | LOW |
| JobQuote → User | `providerId` | Restrict | Cascade | LOW |
| JobQuote → User | `customerId` | Restrict | Cascade | LOW |

**Assessment:** Correct.

### ProviderWallet

| Relation | FK | On Delete | On Update | Risk |
|---|---|---|---|---|
| ProviderWallet → User | `userId` | Cascade | Cascade | MEDIUM — Wallet deletion on user delete |

**Assessment:** Cascade on wallet is risky. Financial records should not be deleted. Consider `Restrict` in Phase 3.

### CustomerWallet

| Relation | FK | On Delete | On Update | Risk |
|---|---|---|---|---|
| CustomerWallet → User | `userId` | Cascade | Cascade | MEDIUM — Same as ProviderWallet |

**Assessment:** Same concern as ProviderWallet.

### WalletTransaction

| Relation | FK | On Delete | On Update | Risk |
|---|---|---|---|---|
| WalletTransaction → ProviderWallet | `walletId` | Cascade | Cascade | MEDIUM — Transaction deletion on wallet delete |
| WalletTransaction → User | `userId` | Cascade | Cascade | LOW |

**Assessment:** Cascade from wallet to transaction is risky. Financial audit trail should persist.

### Conversation / Message

| Relation | FK | On Delete | On Update | Risk |
|---|---|---|---|---|
| ConversationParticipant → Conversation | `conversationId` | Cascade | Cascade | LOW |
| ConversationParticipant → User | `userId` | Cascade | Cascade | LOW |
| Message → Conversation | `conversationId` | Cascade | Cascade | LOW |
| Message → User | `senderId` | Restrict | Cascade | LOW |

**Assessment:** Correct. Deleting a conversation removes participants and messages.

### MarketplaceJob → User

| Relation | FK | On Delete | On Update | Risk |
|---|---|---|---|---|
| MarketplaceJob → User (customer) | `customerId` | Restrict | Cascade | LOW |
| MarketplaceJob → User (provider) | `providerId` | Restrict | Cascade | LOW |

**Assessment:** Correct. Jobs cannot exist without their parties.

## Duplicate Financial Record Hazards

### Potential Duplicates

1. **WalletTransaction without idempotency key** — If the same operation is retried, duplicate transactions can occur.
2. **JobEscrow release without atomic claim** — Fixed in Phase 1 with `updateMany` + status guard.
3. **PayoutRequest without unique constraint** — Multiple requests for the same escrow possible.

### Recommendations

| Issue | Risk | Phase |
|---|---|---|
| WalletTransaction idempotency | MEDIUM | Phase 3 (financial redesign) |
| PayoutRequest unique constraint | LOW | Phase 3 |
| Wallet cascade delete | MEDIUM | Phase 3 |

## Summary

| Category | Count | Immediate Action |
|---|---|---|
| P0 Integrity Issues | 0 | None |
| P1 Concerns | 3 | Document, defer to Phase 3 |
| P2 Concerns | 2 | Document |
| CASCADE Hazards | 2 | Defer to Phase 3 |
