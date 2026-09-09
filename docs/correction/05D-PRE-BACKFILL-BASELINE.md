# 05D-PRE-BACKFILL-BASELINE.md — Pre-Backfill Financial Baseline

**Created**: 2026-09-08
**Backup**: `/tmp/maintainex-backup-5d-20260908-090650.dump` (480KB, 799 TOC entries, PostgreSQL 18.6)

---

## Production Wallet Summary

### Provider Wallets (27 wallets)
| Metric | Value |
|--------|-------|
| Total Available Balance | LKR 2,908,414 |
| Total Pending Balance | LKR 638,853 |
| Wallets with balance > 0 | 27 |

**Top 5 by Available Balance:**
| Provider | Available | Pending |
|----------|-----------|---------|
| cmq6drrw400086z5mbhogyk2m | 189,909 | 22,623 |
| cmqpfypqn001v13jslbfsn1io | 188,269 | 41,644 |
| cmqciyohb0000d8kohk29kbxx | 183,930 | 4,327 |
| cmq0m2x220003as9pzhw0tzv0 | 173,794 | 2,432 |
| cmp8nfaoq0002ykuzze6xn9qo | 173,179 | 23,839 |

### Customer Wallets (46 wallets)
| Metric | Value |
|--------|-------|
| Total Balance | LKR 1,095,942 |
| Wallets with balance > 0 | 46 |

**Top 5 by Balance:**
| Customer | Balance |
|----------|---------|
| cmpxusa560000mqzsfifxllx1 | 73,666 |
| cmq8a0qge000d6z5mjfsodz4f | 49,657 |
| cmp9ynj6z0005ykuztdrkz9qe | 43,344 |
| cmoaf37gv0000v3yim5crkasz | 43,236 |
| cmpyb6hrf00094jgf916meb2z | 40,960 |

---

## Escrow Summary (12 rows)

| Status | Count | Total Amount | Amount | Service Fee |
|--------|-------|-------------|--------|-------------|
| PROTECTED | 5 | 2,445,750 | 2,232,500 | 213,250 |
| ON_HOLD | 3 | 319,000 | 290,000 | 29,000 |
| RELEASED | 2 | 484,000 | 440,000 | 44,000 |
| REFUNDED | 2 | 214,500 | 195,000 | 19,500 |

### Escrow Classification

**Seed/Test Escrow (LKR 2,200,000 + 100,000):**
- `cmr8tovb7000wqyteyxnrh2yj` — PROTECTED, totalAmount 2,200,000 — **SEED** (known orphaned seed data)
- `cmtsfczb6000o350xqjjbkz2v` — PROTECTED, totalAmount 100,000 — **TEST** (5C.1 atomicity test)

**Legitimate Escrow:**
- 3 × ON_HOLD (totalAmount 319,000) — active jobs
- 2 × RELEASED (totalAmount 484,000) — completed jobs
- 2 × REFUNDED (totalAmount 214,500) — refunded jobs
- 2 × PROTECTED (totalAmount 145,750) — active jobs (cmr8tovaj000sqytecjrlx29b: 8,800 + cmr8tovbg0010qytenxzb1clt: 132,000 + cmt2z35a7000w5qrrfbwi7yox: 4,950)

---

## Commission Summary

### CommissionSettlement (10 rows)
| Status | Count | Job Amount | Commission Amount |
|--------|-------|-----------|-------------------|
| SETTLED | 7 | 188,434 | 18,842 |
| PENDING | 3 | 117,859 | 11,786 |

### CommissionPayment (8 rows)
All payments to provider `cmp8nfaoq0002ykuzze6xn9qo`:
- 5 × amountDue: 5,000 (3 CONFIRMED, 2 PENDING)
- 3 × amountDue: 3,000 (1 CONFIRMED, 2 PENDING)

### WeeklySettlement (10 rows)
- 6 PAID (totalEarnings: 535,983, commissionOwed: 53,597)
- 4 PENDING (totalEarnings: 392,836, commissionOwed: 39,283)

---

## FinancialLedger (83 entries)

| Created By | Count | Notes |
|-----------|-------|-------|
| test | 40 | Phase 5C comprehensive tests |
| test-phase5c | 13 | Phase 5C writer integration tests |
| test-5c1 | 30 | Phase 5C.1 safety closure tests |

**System entries: 0** — No production financial flows have triggered ledger writes yet.

---

## IdempotencyRecord (46 entries)

| Status | Count |
|--------|-------|
| COMPLETED | 46 |
| PENDING | 0 |

All records are COMPLETED, no stuck PENDING records.

---

## Float Anomalies

No fractional values detected in ProviderWallet.availableBalance or ProviderWallet.pendingBalance.

---

## Key Observations

1. **All Float monetary fields contain integer values** — no fractional LKR values exist
2. **FinancialLedger has only test data** — 0 production entries. Opening balance backfill will be the first production ledger writes
3. **PROTECTED escrow includes 2 seed/test records** — LKR 2,200,000 seed + LKR 100,000 test must be handled in backfill
4. **WalletBalance table does not exist in production** — must be created before backfill
5. **All 83 ledger entries are from test runs** — can safely coexist with production backfill entries
6. **Commission rate: 10% consistently** across all settlements
7. **Total provider available balance: LKR 2,908,414** — represents net earnings after commission deductions
8. **Total customer wallet balance: LKR 1,095,942** — represents deposited funds minus escrow commitments
