# MaintainEX Phase 1 — Test Results

## Test Run: `npx vitest run tests/phase1/`

```
 ✓ tests/phase1/booking-idor.test.ts (3 tests) 8ms
 ✓ tests/phase1/withdrawal-safety.test.ts (4 tests) 6ms
 ✓ tests/phase1/commission.test.ts (8 tests) 11ms
 ✓ tests/phase1/conversation-idor.test.ts (3 tests) 8ms
 ✓ tests/phase1/invoice-branch.test.ts (4 tests) 12ms
 ✓ tests/phase1/path-traversal.test.ts (8 tests) 20ms

 Test Files  6 passed (6)
      Tests  30 passed (30)
   Duration  603ms
```

## Test Files

| File | Tests | Covers |
|---|---|---|
| `path-traversal.test.ts` | 8 | Valid file, `..` traversal, multiple levels, absolute path, nested file, root, middle `..`, double dots |
| `commission.test.ts` | 8 | 0% rate, 10% rate, 15% rate, >100% clamped, negative clamped, small amount, large amount, max bound |
| `conversation-idor.test.ts` | 3 | Auth required, participant check, authorized participant |
| `booking-idor.test.ts` | 3 | Owner access, provider access, unrelated denial |
| `invoice-branch.test.ts` | 4 | Same branch + permission, different branch denial, super admin, no permission |
| `withdrawal-safety.test.ts` | 4 | Exceeds balance, within balance, zero amount, negative amount |

## All Phase 1 Critical Tests: PASS
