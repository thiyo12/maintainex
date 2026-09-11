import { prisma } from './prisma';
import { type Currency } from './money';
import { createHash, randomUUID } from 'crypto';

function serializeBigInt(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}

export interface LedgerEntry {
  accountId: string;
  accountType: string;
  entryType: 'CREDIT' | 'DEBIT';
  amount: bigint;
}

export interface PostLedgerTransactionInput {
  entries: LedgerEntry[];
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  currency?: Currency;
  description?: string;
  createdBy: string;
  metadata?: string;
}

export interface PostedLedgerTransaction {
  id: string;
  entries: Array<{
    id: string;
    accountId: string;
    entryType: string;
    amount: bigint;
  }>;
}

export interface IdempotencyConflictError {
  type: 'IDEMPOTENCY_CONFLICT';
  existingKey: string;
  message: string;
}

function computePayloadFingerprint(entries: LedgerEntry[], currency: Currency): string {
  const normalized = entries
    .map(e => `${e.accountId}:${e.accountType}:${e.entryType}:${e.amount.toString()}`)
    .sort()
    .join('|');
  return createHash('sha256').update(`${currency}:${normalized}`).digest('hex');
}

function validateEntries(entries: LedgerEntry[], _currency: Currency): void {
  if (entries.length < 2) throw new Error('Ledger transaction must have at least 2 entries');

  const totalCredits = entries
    .filter(e => e.entryType === 'CREDIT')
    .reduce((sum, e) => sum + e.amount, 0n);
  const totalDebits = entries
    .filter(e => e.entryType === 'DEBIT')
    .reduce((sum, e) => sum + e.amount, 0n);

  if (totalCredits !== totalDebits) {
    throw new Error(`Unbalanced ledger: credits=${totalCredits} debits=${totalDebits}`);
  }
  if (totalCredits === 0n) throw new Error('Ledger transaction must have non-zero amounts');

  for (const entry of entries) {
    if (entry.amount <= 0n) throw new Error(`Entry amount must be positive: ${entry.amount}`);
    if (!entry.accountId) throw new Error('Entry must have an accountId');
    if (!entry.accountType) throw new Error('Entry must have an accountType');
  }
}

function validateIdempotencyKey(key: string): void {
  if (!key || key.length > 255) throw new Error('Invalid idempotency key');
}

function isUniqueConstraintViolation(error: any): boolean {
  if (error?.code === 'P2010') return error?.meta?.code === '23505';
  if (error?.code === 'P2002') return true;
  if (error?.message?.includes('23505')) return true;
  return !!(error?.message?.includes('duplicate key') || error?.message?.includes('unique constraint'));
}

type PrismaTxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type WalletUpdate = {
  amount: bigint;
  entryType: 'CREDIT' | 'DEBIT';
  accountType: string;
  accountId: string;
  currency: Currency;
};

async function resolveWalletId(client: PrismaTxClient, update: WalletUpdate): Promise<string> {
  if (update.accountId.startsWith('customer:')) {
    const userId = update.accountId.slice('customer:'.length);
    const wallet = await client.customerWallet.findUnique({ where: { userId }, select: { id: true } });
    if (!wallet) throw new Error('WALLET_NOT_FOUND');
    return wallet.id;
  }
  if (update.accountId.startsWith('provider:')) {
    const userId = update.accountId.slice('provider:'.length);
    const wallet = await client.providerWallet.findUnique({ where: { userId }, select: { id: true } });
    if (!wallet) throw new Error('WALLET_NOT_FOUND');
    return wallet.id;
  }
  return update.accountId;
}

export async function postLedgerTransaction(
  input: PostLedgerTransactionInput,
  tx?: PrismaTxClient
): Promise<PostedLedgerTransaction> {
  const currency = input.currency || 'LKR';
  validateEntries(input.entries, currency);
  validateIdempotencyKey(input.idempotencyKey);
  const fingerprint = computePayloadFingerprint(input.entries, currency);

  const runWith = async (client: PrismaTxClient) => {
    const existing = await client.idempotencyRecord.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });

    if (existing) {
      if (existing.status === 'COMPLETED' && existing.resultPayload) {
        if ((existing.metadata || '') !== fingerprint) {
          throw new Error(`IDEMPOTENCY_CONFLICT: key=${input.idempotencyKey}`);
        }
        const parsed = JSON.parse(existing.resultPayload) as PostedLedgerTransaction;
        return {
          ...parsed,
          entries: parsed.entries.map(entry => ({ ...entry, amount: BigInt(entry.amount) })),
        };
      }
      if (existing.status === 'PENDING') {
        throw new Error(`Duplicate pending idempotency key: ${input.idempotencyKey}`);
      }
    }

    const transactionId = `txn_${randomUUID()}`;
    await client.idempotencyRecord.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        operation: input.referenceType,
        status: 'PENDING',
        metadata: fingerprint,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const createdEntries: PostedLedgerTransaction['entries'] = [];
    const walletUpdates = new Map<string, WalletUpdate>();

    for (const entry of input.entries) {
      const entryIdempotencyKey = `${input.idempotencyKey}:${entry.accountId}:${entry.entryType}:${entry.amount}`;
      const ledgerEntry = await client.financialLedger.create({
        data: {
          groupId: transactionId,
          accountId: entry.accountId,
          accountType: entry.accountType,
          entryType: entry.entryType,
          amount: entry.amount,
          currency,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          idempotencyKey: entryIdempotencyKey,
          description: input.description,
          createdBy: input.createdBy,
          metadata: input.metadata,
        },
      });
      createdEntries.push({
        id: ledgerEntry.id,
        accountId: ledgerEntry.accountId,
        entryType: ledgerEntry.entryType,
        amount: ledgerEntry.amount,
      });

      if (entry.accountType === 'CUSTOMER_WALLET' || entry.accountType === 'PROVIDER_WALLET') {
        const key = `${entry.accountType}:${entry.accountId}:${entry.entryType}`;
        const previous = walletUpdates.get(key);
        if (previous) previous.amount += entry.amount;
        else walletUpdates.set(key, { ...entry, currency });
      }
    }

    for (const update of walletUpdates.values()) {
      const walletId = await resolveWalletId(client, update);
      const delta = update.amount;
      const walletType = update.accountType === 'CUSTOMER_WALLET' ? 'CUSTOMER' : 'PROVIDER';
      const walletCurrency = update.currency;

      if (update.entryType === 'CREDIT') {
        await client.$executeRawUnsafe(
          `INSERT INTO "WalletBalance" ("id", "walletId", "walletType", "balance", "availableBalance", "pendingBalance", "currency", "version", "createdAt", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 0, $5, 1, now(), now())
           ON CONFLICT ("walletType", "walletId", "currency")
           DO UPDATE SET "balance" = "WalletBalance"."balance" + $3,
                         "availableBalance" = "WalletBalance"."availableBalance" + $4,
                         "version" = "WalletBalance"."version" + 1,
                         "updatedAt" = now()`,
          walletId, walletType, delta, delta, walletCurrency
        );
      } else {
        const affected = await client.$executeRawUnsafe(
          `UPDATE "WalletBalance"
           SET "balance" = "balance" - $3,
               "availableBalance" = "availableBalance" - $4,
               "version" = "version" + 1,
               "updatedAt" = now()
           WHERE "walletType" = $2 AND "walletId" = $1 AND "currency" = $5
             AND "balance" >= $3 AND "availableBalance" >= $4`,
          walletId, walletType, delta, delta, walletCurrency
        );
        if (affected === 0) throw new Error('INSUFFICIENT_FUNDS');
      }
    }

    const result: PostedLedgerTransaction = { id: transactionId, entries: createdEntries };
    await client.idempotencyRecord.update({
      where: { idempotencyKey: input.idempotencyKey },
      data: { status: 'COMPLETED', resultPayload: serializeBigInt(result) },
    });
    return result;
  };

  if (tx) return runWith(tx);

  try {
    return await prisma.$transaction(async innerTx => runWith(innerTx));
  } catch (error: any) {
    if (isUniqueConstraintViolation(error)) {
      const retry = await prisma.idempotencyRecord.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (retry?.status === 'COMPLETED' && retry.resultPayload) {
        if ((retry.metadata || '') !== fingerprint) {
          throw new Error(`IDEMPOTENCY_CONFLICT: key=${input.idempotencyKey}`);
        }
        const parsed = JSON.parse(retry.resultPayload) as PostedLedgerTransaction;
        return {
          ...parsed,
          entries: parsed.entries.map(entry => ({ ...entry, amount: BigInt(entry.amount) })),
        };
      }
      throw new Error(`Idempotency key ${input.idempotencyKey} in inconsistent state after conflict`);
    }
    throw error;
  }
}

export async function reverseLedgerTransaction(
  originalGroupId: string,
  reason: string,
  createdBy: string
): Promise<PostedLedgerTransaction> {
  return prisma.$transaction(async (tx) => {
    const originalEntries = await tx.financialLedger.findMany({
      where: { groupId: originalGroupId },
    });
    if (originalEntries.length === 0) throw new Error(`Original transaction ${originalGroupId} not found`);

    const existingReversal = await tx.financialLedger.findFirst({
      where: {
        referenceType: 'REVERSAL',
        referenceId: originalGroupId,
      },
    });
    if (existingReversal) throw new Error(`Transaction ${originalGroupId} already reversed (ONE_REVERSAL_ONLY)`);

    return postLedgerTransaction({
      entries: originalEntries.map(entry => ({
        accountId: entry.accountId,
        accountType: entry.accountType,
        entryType: (entry.entryType === 'CREDIT' ? 'DEBIT' : 'CREDIT') as 'CREDIT' | 'DEBIT',
        amount: entry.amount,
      })),
      referenceType: 'REVERSAL',
      referenceId: originalGroupId,
      idempotencyKey: `reversal:${originalGroupId}`,
      currency: (originalEntries[0]?.currency as Currency) || 'LKR',
      description: `Reversal of ${originalGroupId}: ${reason}`,
      createdBy,
    }, tx);
  });
}

export async function postWalletCredit(
  walletId: string,
  walletType: string,
  amount: bigint,
  referenceType: string,
  referenceId: string,
  idempotencyKey: string,
  createdBy: string,
  currency?: Currency
): Promise<PostedLedgerTransaction> {
  return postLedgerTransaction({
    entries: [
      { accountId: walletId, accountType: walletType, entryType: 'CREDIT', amount },
      { accountId: 'platform', accountType: 'PLATFORM', entryType: 'DEBIT', amount },
    ],
    referenceType,
    referenceId,
    idempotencyKey,
    currency,
    description: `Wallet credit: ${referenceType}`,
    createdBy,
  });
}

export async function postWalletDebit(
  walletId: string,
  walletType: string,
  amount: bigint,
  referenceType: string,
  referenceId: string,
  idempotencyKey: string,
  createdBy: string,
  currency?: Currency
): Promise<PostedLedgerTransaction> {
  return postLedgerTransaction({
    entries: [
      { accountId: walletId, accountType: walletType, entryType: 'DEBIT', amount },
      { accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount },
    ],
    referenceType,
    referenceId,
    idempotencyKey,
    currency,
    description: `Wallet debit: ${referenceType}`,
    createdBy,
  });
}

export async function postEscrowDeposit(
  escrowId: string,
  customerId: string,
  amount: bigint,
  idempotencyKey: string,
  currency?: Currency
): Promise<PostedLedgerTransaction> {
  return postLedgerTransaction({
    entries: [
      { accountId: `escrow:${escrowId}`, accountType: 'ESCROW', entryType: 'CREDIT', amount },
      { accountId: `customer:${customerId}`, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount },
    ],
    referenceType: 'ESCROW_DEPOSIT',
    referenceId: escrowId,
    idempotencyKey,
    currency,
    description: 'Escrow deposit for job',
    createdBy: 'system',
  });
}

export async function postEscrowRelease(
  escrowId: string,
  providerId: string,
  amount: bigint,
  commission: bigint,
  idempotencyKey: string,
  currency?: Currency
): Promise<PostedLedgerTransaction> {
  const providerAmount = amount - commission;
  const entries: LedgerEntry[] = [
    { accountId: `escrow:${escrowId}`, accountType: 'ESCROW', entryType: 'DEBIT', amount },
    { accountId: `provider:${providerId}`, accountType: 'PROVIDER_WALLET', entryType: 'CREDIT', amount: providerAmount },
  ];
  if (commission > 0n) {
    entries.push({ accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount: commission });
  }
  return postLedgerTransaction({
    entries,
    referenceType: 'ESCROW_RELEASE',
    referenceId: escrowId,
    idempotencyKey,
    currency,
    description: 'Escrow release with commission',
    createdBy: 'system',
  });
}

export async function postEscrowRefund(
  escrowId: string,
  customerId: string,
  amount: bigint,
  idempotencyKey: string,
  currency?: Currency
): Promise<PostedLedgerTransaction> {
  return postLedgerTransaction({
    entries: [
      { accountId: `escrow:${escrowId}`, accountType: 'ESCROW', entryType: 'DEBIT', amount },
      { accountId: `customer:${customerId}`, accountType: 'CUSTOMER_WALLET', entryType: 'CREDIT', amount },
    ],
    referenceType: 'ESCROW_REFUND',
    referenceId: escrowId,
    idempotencyKey,
    currency,
    description: 'Escrow refund',
    createdBy: 'system',
  });
}

export async function getLedgerBalance(
  accountId: string,
  accountType: string
): Promise<{ credits: bigint; debits: bigint; balance: bigint }> {
  const entries = await prisma.financialLedger.findMany({
    where: { accountId, accountType },
    select: { entryType: true, amount: true },
  });
  let credits = 0n;
  let debits = 0n;
  for (const entry of entries) {
    if (entry.entryType === 'CREDIT') credits += entry.amount;
    else debits += entry.amount;
  }
  return { credits, debits, balance: credits - debits };
}

export async function getLedgerEntries(
  accountId: string,
  accountType: string,
  options?: { limit?: number; offset?: number; referenceType?: string }
) {
  const where: any = { accountId, accountType };
  if (options?.referenceType) where.referenceType = options.referenceType;
  return prisma.financialLedger.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
  });
}
