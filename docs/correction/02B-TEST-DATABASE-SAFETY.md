# MaintainEX Test Database Safety

## Purpose

Ensure integration tests never connect to production, staging, or any shared database.

## Safety Rules

### Required Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `TEST_DATABASE_URL` | YES | Connection string for test database |
| `NODE_ENV` | Recommended | Should be `test` for integration tests |

### Rejection Criteria

Tests MUST refuse to execute if:

1. `TEST_DATABASE_URL` is not set
2. `TEST_DATABASE_URL` equals `DATABASE_URL`
3. Hostname contains production indicators:
   - `147.93.106.54` (VPS IP)
   - `maintainex.lk`
   - `dokploy`
4. Database name does not end with `_test` (recommended convention)

### Implementation

```typescript
// tests/setup.ts
function assertTestDatabase() {
  const testUrl = process.env.TEST_DATABASE_URL
  const prodUrl = process.env.DATABASE_URL
  
  if (!testUrl) {
    throw new Error('TEST_DATABASE_URL is required for integration tests')
  }
  
  if (testUrl === prodUrl) {
    throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL')
  }
  
  const prodIndicators = ['147.93.106.54', 'maintainex.lk', 'dokploy']
  for (const indicator of prodIndicators) {
    if (testUrl.includes(indicator)) {
      throw new Error(`TEST_DATABASE_URL must not point to production (${indicator})`)
    }
  }
}
```

## Local Test Database

| Property | Value |
|---|---|
| URL | `postgresql://maintainex:maintainex_dev_2025@localhost:5432/maintainex_test` |
| Isolation | Separate database from development |
| Creation | `createdb maintainex_test` or Docker Compose |

## Running Integration Tests

```bash
# Start PostgreSQL
docker compose up -d

# Create test database
docker compose exec postgres createdb -U maintainex maintainex_test

# Run tests
TEST_DATABASE_URL="postgresql://maintainex:maintainex_dev_2025@localhost:5432/maintainex_test" \
  npm test
```
