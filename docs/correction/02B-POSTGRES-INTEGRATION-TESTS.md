# MaintainEX PostgreSQL Integration Tests

## Status

**BLOCKED** — No PostgreSQL instance available locally (Docker not installed).

## Test Infrastructure Required

### Dependencies

| Package | Purpose |
|---|---|
| `vitest` | Test runner (already installed) |
| `@prisma/client` | Database access (already installed) |
| PostgreSQL | Database (requires Docker) |

### Test Database Setup

```bash
# Start PostgreSQL
docker compose up -d

# Create test database
docker compose exec postgres createdb -U maintainex maintainex_test

# Set environment
export TEST_DATABASE_URL="postgresql://maintainex:maintainex_dev_2025@localhost:5432/maintainex_test"

# Push schema (DEVELOPMENT/TEST ONLY)
DATABASE_URL="$TEST_DATABASE_URL" npx prisma db push
```

## Escrow Concurrency Test

### Scenario

1. Create customer, provider, job, escrow (ON_HOLD), provider wallet
2. Fire 2 concurrent release attempts
3. Verify: escrow released once, wallet credited once, one transaction

### Expected Code Structure

```typescript
// tests/integration/escrow-concurrency.test.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } })

describe('Escrow PostgreSQL Concurrency', () => {
  it('releases escrow exactly once under concurrent access', async () => {
    // Setup: customer, provider, job, escrow, wallet
    // Execute: Promise.all([releaseEscrow(escrowId), releaseEscrow(escrowId)])
    // Assert: wallet balance = escrow amount exactly once
  })
})
```

## Transaction Rollback Test

### Scenario

1. Create escrow and wallet
2. Start transaction
3. Credit wallet
4. Force error before commit
5. Verify: wallet unchanged, escrow unchanged

### Expected Code Structure

```typescript
// tests/integration/transaction-rollback.test.ts
describe('Transaction Rollback', () => {
  it('rolls back wallet credit on error', async () => {
    // Setup: escrow, wallet with balance 0
    // Execute: $transaction that credits then throws
    // Assert: wallet balance still 0
  })
})
```

## Ownership Tests

### Scenario

1. Create two users
2. Create conversation belonging to user A
3. Verify user B cannot access it through the service layer

### Expected Code Structure

```typescript
// tests/integration/ownership.test.ts
describe('Ownership', () => {
  it('prevents unauthorized conversation access', async () => {
    // Setup: userA, userB, conversation with userA as participant
    // Execute: getConversation(conversationId, userB.id)
    // Assert: returns null or throws
  })
})
```

## Blocking Issue

Docker not installed on this machine. All PostgreSQL integration tests are BLOCKED.

## Resolution

When Docker is available:
1. `docker compose up -d`
2. Create test database
3. Run `npx vitest run tests/integration/`
4. Update this document with actual results
