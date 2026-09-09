# MaintainEX Database Index Review

## Hot Tables Analysis

### MarketplaceJob (Active V2)

**Current Indexes:**
- `MarketplaceJob_pkey` (id)
- `MarketplaceJob_customerId_idx`
- `MarketplaceJob_providerId_idx`
- `MarketplaceJob_status_idx`
- `MarketplaceJob_categoryId_idx`
- `MarketplaceJob_createdAt_idx`
- `MarketplaceJob_areaId_idx`

**Query Patterns:**
- Customer jobs list: `WHERE customerId = ? ORDER BY createdAt DESC`
- Provider jobs list: `WHERE providerId = ? AND status IN (...)`
- Admin jobs list: `WHERE status = ? ORDER BY createdAt DESC`
- Category search: `WHERE categoryId = ? AND status = 'ACTIVE'`
- Location search: `WHERE areaId = ? AND status = 'ACTIVE'`

**Recommendation:** Add composite index for provider+status queries:
```sql
CREATE INDEX "MarketplaceJob_providerId_status_idx" ON "MarketplaceJob"("providerId", "status");
```

### JobEscrow

**Current Indexes:**
- `JobEscrow_pkey` (id)
- `JobEscrow_jobId_idx`
- `JobEscrow_status_idx`

**Query Patterns:**
- Cron release: `WHERE status = 'ON_HOLD' AND releaseAt < NOW()`
- Provider escrows: `WHERE providerId = ? AND status IN (...)`

**Recommendation:** Add composite index for cron release:
```sql
CREATE INDEX "JobEscrow_status_releaseAt_idx" ON "JobEscrow"("status", "releaseAt");
```

### ProviderWallet

**Current Indexes:**
- `ProviderWallet_pkey` (id)
- `ProviderWallet_userId_idx`

**Query Patterns:**
- Balance lookup: `WHERE userId = ?`
- Sufficient balance check: `WHERE userId = ? AND availableBalance >= ?`

**Recommendation:** Sufficient balance check is rare and selective. Current index is sufficient.

### CustomerWallet

**Current Indexes:**
- `CustomerWallet_pkey` (id)
- `CustomerWallet_userId_idx`

**Query Patterns:**
- Balance lookup: `WHERE userId = ?`
- Balance deduction: `WHERE userId = ? AND balance >= ?`

**Recommendation:** Current index is sufficient.

### Conversation

**Current Indexes:**
- `Conversation_pkey` (id)
- `Conversation_updatedAt_idx`

**Query Patterns:**
- User conversations: Join with `ConversationParticipant WHERE userId = ?`
- Recent messages: `WHERE conversationId = ? ORDER BY createdAt DESC`

**Recommendation:** Current indexes are sufficient.

### Message

**Current Indexes:**
- `Message_pkey` (id)
- `Message_conversationId_createdAt_idx`
- `Message_senderId_idx`

**Query Patterns:**
- Conversation messages: `WHERE conversationId = ? ORDER BY createdAt ASC`
- Unread count: `WHERE conversationId = ? AND read = false`

**Recommendation:** Current indexes are sufficient.

### Notification

**Current Indexes:**
- `Notification_pkey` (id)
- `Notification_userId_idx`
- `Notification_read_idx`

**Query Patterns:**
- User notifications: `WHERE userId = ? ORDER BY createdAt DESC`
- Unread count: `WHERE userId = ? AND read = false`

**Recommendation:** Current indexes are sufficient.

## Summary

| Table | Current Indexes | Recommended New | Priority |
|---|---|---|---|
| MarketplaceJob | 7 | 1 (provider+status) | Medium |
| JobEscrow | 3 | 1 (status+releaseAt) | High |
| ProviderWallet | 2 | 0 | None |
| CustomerWallet | 2 | 0 | None |
| Conversation | 2 | 0 | None |
| Message | 3 | 0 | None |
| Notification | 3 | 0 | None |

## Notes

- Do not blindly add indexes. Each index adds write overhead.
- Only add if query evidence clearly supports it.
- Monitor slow query logs in production before adding.
