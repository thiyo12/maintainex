import { prisma } from './prisma';
import { legacyToMinorUnits, hasFractionalParts, type Currency } from '@/lib/shared/money/money';

interface BackfillResult {
  table: string;
  field: string;
  totalRows: number;
  converted: number;
  skipped: number;
  errors: string[];
}

interface BackfillOptions {
  dryRun?: boolean;
  batchSize?: number;
  currency?: Currency;
}

const LEGACY_FIELDS: Array<{
  model: string;
  field: string;
  shadowField: string;
  currency?: Currency;
}> = [
  { model: 'ProviderWallet', field: 'availableBalance', shadowField: 'availableBalanceMinor' },
  { model: 'ProviderWallet', field: 'pendingBalance', shadowField: 'pendingBalanceMinor' },
  { model: 'CustomerWallet', field: 'balance', shadowField: 'balanceMinor' },
  { model: 'WalletTransaction', field: 'amount', shadowField: 'amountMinor' },
  { model: 'WalletTransaction', field: 'balanceBefore', shadowField: 'balanceBeforeMinor' },
  { model: 'WalletTransaction', field: 'balanceAfter', shadowField: 'balanceAfterMinor' },
  { model: 'WeeklySettlement', field: 'totalEarnings', shadowField: 'totalEarningsMinor' },
  { model: 'WeeklySettlement', field: 'commissionOwed', shadowField: 'commissionOwedMinor' },
  { model: 'CommissionPayment', field: 'amountDue', shadowField: 'amountDueMinor' },
];

export async function backfillField(
  model: string,
  field: string,
  shadowField: string,
  options: BackfillOptions = {}
): Promise<BackfillResult> {
  const { dryRun = false, batchSize = 100, currency = 'LKR' } = options;
  const result: BackfillResult = {
    table: model,
    field,
    totalRows: 0,
    converted: 0,
    skipped: 0,
    errors: [],
  };

  const client = prisma as any;
  const modelClient = client[model.toLowerCase()];
  if (!modelClient) {
    result.errors.push(`Model ${model} not found`);
    return result;
  }

  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const rows = await modelClient.findMany({
      where: { [shadowField]: null },
      take: batchSize,
      skip: offset,
      select: { id: true, [field]: true },
    });

    if (rows.length === 0) {
      hasMore = false;
      break;
    }

    result.totalRows += rows.length;

    for (const row of rows) {
      const legacyValue = row[field];
      if (legacyValue === null || legacyValue === undefined) {
        result.skipped++;
        continue;
      }

      if (hasFractionalParts(legacyValue, currency)) {
        result.errors.push(`Fractional value detected in ${model} ${row.id}.${field}: ${legacyValue}`);
        result.skipped++;
        continue;
      }

      try {
        const minorUnits = legacyToMinorUnits(legacyValue, currency);
        if (!dryRun) {
          await modelClient.update({
            where: { id: row.id },
            data: { [shadowField]: minorUnits },
          });
        }
        result.converted++;
      } catch (e) {
        result.errors.push(`Conversion error ${model} ${row.id}.${field}: ${e}`);
        result.skipped++;
      }
    }

    offset += batchSize;
  }

  return result;
}

export async function backfillAll(options: BackfillOptions = {}): Promise<BackfillResult[]> {
  const results: BackfillResult[] = [];

  for (const fieldDef of LEGACY_FIELDS) {
    const result = await backfillField(
      fieldDef.model,
      fieldDef.field,
      fieldDef.shadowField,
      { ...options, currency: fieldDef.currency || options.currency }
    );
    results.push(result);
  }

  return results;
}

export async function reconcileBackfill(
  model: string,
  field: string,
  shadowField: string,
  currency: Currency = 'LKR'
): Promise<{
  totalRows: number;
  matched: number;
  mismatched: number;
  mismatches: Array<{ id: string; legacy: number; canonical: bigint }>;
}> {
  const client = prisma as any;
  const modelClient = client[model.toLowerCase()];

  const rows = await modelClient.findMany({
    where: { [shadowField]: { not: null } },
    select: { id: true, [field]: true, [shadowField]: true },
  });

  const result = {
    totalRows: rows.length,
    matched: 0,
    mismatched: 0,
    mismatches: [] as Array<{ id: string; legacy: number; canonical: bigint }>,
  };

  for (const row of rows) {
    const legacyValue = row[field];
    const canonicalValue = row[shadowField];

    if (legacyValue === null || legacyValue === undefined) {
      result.matched++;
      continue;
    }

    const expectedMinor = legacyToMinorUnits(legacyValue, currency);
    if (expectedMinor === canonicalValue) {
      result.matched++;
    } else {
      result.mismatched++;
      result.mismatches.push({
        id: row.id,
        legacy: legacyValue,
        canonical: canonicalValue,
      });
    }
  }

  return result;
}

export async function generateOpeningBalances(
  options: { dryRun?: boolean; currency?: Currency } = {}
): Promise<Array<{
  accountId: string;
  accountType: string;
  amount: bigint;
  currency: string;
}>> {
  const { dryRun = false, currency = 'LKR' } = options;
  const openingBalances: Array<{
    accountId: string;
    accountType: string;
    amount: bigint;
    currency: string;
  }> = [];

  const providerWallets = await prisma.providerWallet.findMany({
    where: { availableBalance: { gt: 0 } },
    select: { id: true, availableBalance: true },
  });

  for (const wallet of providerWallets) {
    if (wallet.availableBalance) {
      openingBalances.push({
        accountId: wallet.id,
        accountType: 'PROVIDER_WALLET',
        amount: BigInt(Math.round(wallet.availableBalance * 100)),
        currency,
      });
    }
  }

  const customerWallets = await prisma.customerWallet.findMany({
    where: { balance: { gt: 0 } },
    select: { id: true, balance: true },
  });

  for (const wallet of customerWallets) {
    if (wallet.balance) {
      openingBalances.push({
        accountId: wallet.id,
        accountType: 'CUSTOMER_WALLET',
        amount: BigInt(Math.round(wallet.balance * 100)),
        currency,
      });
    }
  }

  return openingBalances;
}

export function printBackfillResults(results: BackfillResult[]): void {
  console.log('\n=== BACKFILL RESULTS ===\n');
  let totalConverted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const r of results) {
    const status = r.errors.length > 0 ? 'ERRORS' : r.skipped > 0 ? 'PARTIAL' : 'OK';
    console.log(`${r.table}.${r.field}: ${status}`);
    console.log(`  Total: ${r.totalRows}, Converted: ${r.converted}, Skipped: ${r.skipped}`);
    if (r.errors.length > 0) {
      console.log(`  Errors: ${r.errors.length}`);
      for (const e of r.errors.slice(0, 5)) {
        console.log(`    - ${e}`);
      }
    }
    totalConverted += r.converted;
    totalSkipped += r.skipped;
    totalErrors += r.errors.length;
  }

  console.log(`\nTotal: Converted=${totalConverted}, Skipped=${totalSkipped}, Errors=${totalErrors}`);
}
