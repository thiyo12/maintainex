# MaintainEX Rollback Test

## Environment

- Database: `maintainex_test` on VPS PostgreSQL
- Method: PostgreSQL transaction with controlled failure

## Procedure

```sql
BEGIN;
  -- Step 1: Release escrow (succeeds)
  UPDATE "JobEscrow" SET status = 'RELEASED' WHERE id = 'esc-rb' AND status = 'ON_HOLD';
  
  -- Step 2: Insert invalid reference (fails due to foreign key or constraint)
  INSERT INTO "WalletTransaction" (...) VALUES (..., 'INVALID_TYPE', ...);
ROLLBACK;
```

## Results

| Check | Expected | Actual | Status |
|---|---|---|---|
| Escrow status after rollback | ON_HOLD | ON_HOLD | PASS |
| Wallet balance after rollback | 0 | 0 | PASS |
| Transaction count after rollback | 0 | 0 | PASS |

## Verification

After ROLLBACK:
- Escrow reverted from RELEASED → ON_HOLD
- Wallet balance remained 0 (no credit)
- No WalletTransaction record created

**TRANSACTION ROLLBACK — PASS**
