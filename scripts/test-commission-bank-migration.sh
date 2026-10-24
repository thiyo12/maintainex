#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-}"
[[ "$DATABASE_URL" == postgresql://*'@localhost:5432/maintainex_test_phase07_ci'* ]] || {
  printf '[BANK-MIGRATION-TEST] Refusing a database outside isolated GitHub CI.\n' >&2
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
INSERT INTO "CommissionPayment" VALUES ('upgrade-payment');
INSERT INTO "ProviderCommissionReceivable" VALUES ('upgrade-receivable');
SQL

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f prisma/migrations/20261025110000_commission_bank_reconciliation/migration.sql >/dev/null
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f prisma/migrations/20261025120000_commission_bank_payment_link/migration.sql >/dev/null

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

printf '[BANK-MIGRATION-TEST] Additive migration applied to an isolated prior-schema fixture; keys, foreign keys, constraints and append-only triggers verified.\n'
