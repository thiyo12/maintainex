#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-}"
MIGRATION_TEST_PORT="${MAINTAINEX_MIGRATION_TEST_PORT:-5432}"
[[ "$MIGRATION_TEST_PORT" =~ ^[0-9]{1,5}$ ]] && (( MIGRATION_TEST_PORT >= 1 && MIGRATION_TEST_PORT <= 65535 )) || {
  printf '[BANK-MIGRATION-TEST] Invalid isolated PostgreSQL port.\n' >&2
  exit 1
}
[[ "$DATABASE_URL" == postgresql://*"@localhost:${MIGRATION_TEST_PORT}/maintainex_test_phase07_ci"* ]] || {
  printf '[BANK-MIGRATION-TEST] Refusing a database outside the isolated migration-test database.\n' >&2
  exit 1
}

RUN_KEY="${GITHUB_RUN_ID:-local}_$$"
[[ "$RUN_KEY" =~ ^[A-Za-z0-9_]+$ ]] || exit 1
SCHEMA="commission_bank_migration_${RUN_KEY}"
PGOPTIONS="-c search_path=${SCHEMA}"
export PGOPTIONS
cleanup() { psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS \"${SCHEMA}\" CASCADE" >/dev/null; }
trap cleanup EXIT

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<SQL
CREATE SCHEMA "${SCHEMA}";
SET search_path TO "${SCHEMA}";
CREATE TABLE "CommissionPayment" ("id" TEXT PRIMARY KEY);
CREATE TABLE "ProviderCommissionReceivable" ("id" TEXT PRIMARY KEY);
CREATE TABLE "ProviderIdentity" ("id" TEXT PRIMARY KEY);
CREATE TABLE "ProviderCommissionRecovery" ("id" TEXT PRIMARY KEY);
INSERT INTO "CommissionPayment" VALUES ('upgrade-payment');
INSERT INTO "ProviderCommissionReceivable" VALUES ('upgrade-receivable');
INSERT INTO "ProviderIdentity" VALUES ('identity-1');
INSERT INTO "ProviderCommissionRecovery" VALUES ('upgrade-recovery');
SQL

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f prisma/migrations/20261025110000_commission_bank_reconciliation/migration.sql >/dev/null
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f prisma/migrations/20261025120000_commission_bank_payment_link/migration.sql >/dev/null
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f prisma/migrations/20261025130000_commission_bank_reversals/migration.sql >/dev/null

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO "CommissionBankStatementImport" (
  "id", "sourceSystem", "statementId", "accountRef", "countryCode", "currency",
  "contentSha256", "provenanceType", "importedByAdminId", "rowCount"
) VALUES (
  'upgrade-statement', 'MANUAL_STATEMENT', 'UPGRADE-STATEMENT-1', 'LK-FIN-1', 'LK', 'LKR',
  repeat('a', 64), 'STATEMENT_FILE', 'finance-test', 1
);
INSERT INTO "CommissionBankTransaction" (
  "id", "statementImportId", "sourceSystem", "transactionId", "bankAccountRef", "direction",
  "amountMinor", "currency", "countryCode", "reference"
) VALUES (
  'upgrade-txn', 'upgrade-statement', 'MANUAL_STATEMENT', 'UPGRADE-TXN-1', 'LK-FIN-1', 'CREDIT',
  100, 'LKR', 'LK', 'UPGRADE-REF'
);
INSERT INTO "CommissionBankStatementImport" (
  "id", "sourceSystem", "statementId", "accountRef", "countryCode", "currency",
  "contentSha256", "provenanceType", "importedByAdminId", "rowCount"
) VALUES (
  'upgrade-reversal-statement', 'MANUAL_STATEMENT', 'UPGRADE-REVERSAL-STATEMENT', 'LK-FIN-1', 'LK', 'LKR',
  repeat('b', 64), 'STATEMENT_FILE', 'finance-test', 1
);
INSERT INTO "CommissionBankTransaction" (
  "id", "statementImportId", "sourceSystem", "transactionId", "bankAccountRef", "direction",
  "amountMinor", "currency", "countryCode", "reference", "reversalOfTransactionId"
) VALUES (
  'upgrade-reversal-txn', 'upgrade-reversal-statement', 'MANUAL_STATEMENT', 'UPGRADE-REVERSAL-TXN', 'LK-FIN-1', 'DEBIT',
  25, 'LKR', 'LK', 'UPGRADE-REF', 'UPGRADE-TXN-1'
);
INSERT INTO "CommissionBankReconciliation" (
  "id", "bankTransactionId", "providerIdentityId", "commissionPaymentId", "initiatedByAdminId",
  "totalAmountMinor", "currency", "countryCode", "updatedAt"
) VALUES ('upgrade-reconciliation', 'upgrade-txn', 'identity-1', 'upgrade-payment', 'finance-test', 100, 'LKR', 'LK', now());
INSERT INTO "CommissionBankAllocation" ("id", "reconciliationId", "receivableId", "amountMinor")
VALUES ('upgrade-allocation', 'upgrade-reconciliation', 'upgrade-receivable', 100);
INSERT INTO "CommissionBankStatementEvent" ("id", "statementImportId", "eventType", "actor")
VALUES ('upgrade-statement-event', 'upgrade-statement', 'STATEMENT_IMPORTED', 'finance-test');
INSERT INTO "CommissionBankReconciliationEvent" ("id", "reconciliationId", "eventType", "actorAdminId")
VALUES ('upgrade-reconciliation-event', 'upgrade-reconciliation', 'RECONCILIATION_PROPOSED', 'finance-test');
UPDATE "CommissionBankReconciliation" SET "status" = 'POSTED' WHERE id = 'upgrade-reconciliation';
INSERT INTO "CommissionBankReversal" (
  "id", "bankTransactionId", "originalBankTransactionId", "originalReconciliationId", "providerIdentityId",
  "initiatedByAdminId", "status", "amountMinor", "currency", "countryCode", "updatedAt"
) VALUES (
  'upgrade-reversal', 'upgrade-reversal-txn', 'upgrade-txn', 'upgrade-reconciliation', 'identity-1',
  'finance-maker', 'PENDING_REVIEW', 25, 'LKR', 'LK', now()
);
INSERT INTO "CommissionBankReversalAllocation" (
  "id", "reversalId", "originalAllocationId", "recoveryId", "amountMinor"
) VALUES ('upgrade-reversal-allocation', 'upgrade-reversal', 'upgrade-allocation', 'upgrade-recovery', 25);
INSERT INTO "CommissionBankReversalEvent" ("id", "reversalId", "eventType", "actorAdminId")
VALUES ('upgrade-reversal-event', 'upgrade-reversal', 'REVERSAL_PROPOSED', 'finance-maker');
SQL

if psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c \
  "UPDATE \"CommissionBankAllocation\" SET \"amountMinor\" = 200 WHERE id = 'upgrade-allocation'" >/dev/null 2>&1; then
  printf '[BANK-MIGRATION-TEST] Append-only allocation trigger did not reject UPDATE.\n' >&2
  exit 1
fi
if psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c \
  "DELETE FROM \"CommissionBankStatementEvent\" WHERE id = 'upgrade-statement-event'" >/dev/null 2>&1; then
  printf '[BANK-MIGRATION-TEST] Append-only statement event trigger did not reject DELETE.\n' >&2
  exit 1
fi
if psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c \
  "UPDATE \"CommissionBankStatementImport\" SET \"provenanceStatus\" = 'VERIFIED' WHERE id = 'upgrade-statement'" >/dev/null 2>&1; then
  printf '[BANK-MIGRATION-TEST] Verified provenance constraint accepted a row without source evidence.\n' >&2
  exit 1
fi
if psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c \
  "INSERT INTO \"CommissionBankTransaction\" (\"id\",\"statementImportId\",\"sourceSystem\",\"transactionId\",\"bankAccountRef\",\"direction\",\"amountMinor\",\"currency\",\"countryCode\",\"reference\") VALUES ('duplicate-txn','upgrade-statement','MANUAL_STATEMENT','UPGRADE-TXN-1','LK-FIN-1','CREDIT',100,'LKR','LK','UPGRADE-REF')" >/dev/null 2>&1; then
  printf '[BANK-MIGRATION-TEST] Duplicate bank transaction was accepted.\n' >&2
  exit 1
fi
if psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c \
  "INSERT INTO \"CommissionBankTransaction\" (\"id\",\"statementImportId\",\"sourceSystem\",\"transactionId\",\"bankAccountRef\",\"direction\",\"amountMinor\",\"currency\",\"countryCode\",\"reference\") VALUES ('zero-txn','upgrade-statement','MANUAL_STATEMENT','UPGRADE-TXN-ZERO','LK-FIN-1','CREDIT',0,'LKR','LK','UPGRADE-REF')" >/dev/null 2>&1; then
  printf '[BANK-MIGRATION-TEST] Zero-amount bank transaction was accepted.\n' >&2
  exit 1
fi
if psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c \
  "UPDATE \"CommissionBankReversalAllocation\" SET \"amountMinor\" = 50 WHERE id = 'upgrade-reversal-allocation'" >/dev/null 2>&1; then
  printf '[BANK-MIGRATION-TEST] Append-only reversal allocation trigger did not reject UPDATE.\n' >&2
  exit 1
fi
if psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c \
  "DELETE FROM \"CommissionBankReversalEvent\" WHERE id = 'upgrade-reversal-event'" >/dev/null 2>&1; then
  printf '[BANK-MIGRATION-TEST] Append-only reversal event trigger did not reject DELETE.\n' >&2
  exit 1
fi
if psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c \
  "INSERT INTO \"CommissionBankReversal\" (\"id\",\"bankTransactionId\",\"originalBankTransactionId\",\"originalReconciliationId\",\"providerIdentityId\",\"initiatedByAdminId\",\"amountMinor\",\"currency\",\"countryCode\",\"updatedAt\") VALUES ('duplicate-reversal','upgrade-reversal-txn','upgrade-txn','upgrade-reconciliation','identity-1','finance-maker',25,'LKR','LK',now())" >/dev/null 2>&1; then
  printf '[BANK-MIGRATION-TEST] Duplicate reversal of one bank debit was accepted.\n' >&2
  exit 1
fi

printf '[BANK-MIGRATION-TEST] Additive bank reconciliation and reversal migrations applied to an isolated prior-schema fixture; constraints, foreign keys, idempotency and append-only triggers verified.\n'
