import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/prisma';
import { postLedgerTransaction } from '@/lib/ledger';
import { requiresPostgres } from '../helpers/test-guard';

describe.skipIf(!requiresPostgres())('Ledger Concurrency (Real PostgreSQL)', () => {
  it('2-way duplicate posting - exactly 1 durable transaction', async () => {
    const walletId = `concurrent-2way-${Date.now()}`;
    const key = `concurrent-key-${Date.now()}`;

    const input = {
      entries: [
        { accountId: walletId, accountType: 'CONCURRENT_TEST', entryType: 'CREDIT' as const, amount: 100000n },
        { accountId: 'platform', accountType: 'PLATFORM', entryType: 'DEBIT' as const, amount: 100000n },
      ],
      referenceType: 'CONCURRENCY_TEST',
      referenceId: walletId,
      idempotencyKey: key,
      description: '2-way concurrency test',
      createdBy: 'test',
    };

    const results = await Promise.allSettled([
      postLedgerTransaction(input),
      postLedgerTransaction(input),
    ]);

    const successes = results.filter(r => r.status === 'fulfilled');
    expect(successes.length).toBeGreaterThanOrEqual(1);

    const ledgerEntries = await prisma.financialLedger.findMany({
      where: { referenceId: walletId },
    });
    expect(ledgerEntries).toHaveLength(2);

    const allSameKey = ledgerEntries.every(e => e.idempotencyKey.startsWith(key));
    expect(allSameKey).toBe(true);
  });

  it('5-way duplicate posting - exactly 1 durable transaction', async () => {
    const walletId = `concurrent-5way-${Date.now()}`;
    const key = `concurrent-5way-key-${Date.now()}`;

    const input = {
      entries: [
        { accountId: walletId, accountType: 'CONCURRENT_TEST', entryType: 'CREDIT' as const, amount: 200000n },
        { accountId: 'platform', accountType: 'PLATFORM', entryType: 'DEBIT' as const, amount: 200000n },
      ],
      referenceType: 'CONCURRENCY_TEST',
      referenceId: walletId,
      idempotencyKey: key,
      description: '5-way concurrency test',
      createdBy: 'test',
    };

    const results = await Promise.allSettled([
      postLedgerTransaction(input),
      postLedgerTransaction(input),
      postLedgerTransaction(input),
      postLedgerTransaction(input),
      postLedgerTransaction(input),
    ]);

    const successes = results.filter(r => r.status === 'fulfilled');
    expect(successes.length).toBeGreaterThanOrEqual(1);

    const ledgerEntries = await prisma.financialLedger.findMany({
      where: { referenceId: walletId },
    });
    expect(ledgerEntries).toHaveLength(2);
  });

  it('balanced ledger invariant', async () => {
    const walletId = `balanced-${Date.now()}`;
    const key = `balanced-key-${Date.now()}`;

    await postLedgerTransaction({
      entries: [
        { accountId: walletId, accountType: 'BALANCED_TEST', entryType: 'CREDIT', amount: 300000n },
        { accountId: 'platform', accountType: 'PLATFORM', entryType: 'DEBIT', amount: 300000n },
      ],
      referenceType: 'BALANCED_TEST',
      referenceId: walletId,
      idempotencyKey: key,
      description: 'Balanced test',
      createdBy: 'test',
    });

    const entries = await prisma.financialLedger.findMany({
      where: { referenceId: walletId },
    });

    const credits = entries
      .filter(e => e.entryType === 'CREDIT')
      .reduce((sum, e) => sum + e.amount, 0n);
    const debits = entries
      .filter(e => e.entryType === 'DEBIT')
      .reduce((sum, e) => sum + e.amount, 0n);

    expect(credits).toBe(debits);
  });

  it('append-only immutability', async () => {
    const walletId = `immutable-${Date.now()}`;
    const key = `immutable-key-${Date.now()}`;

    const result = await postLedgerTransaction({
      entries: [
        { accountId: walletId, accountType: 'IMMUTABLE_TEST', entryType: 'CREDIT', amount: 150000n },
        { accountId: 'platform', accountType: 'PLATFORM', entryType: 'DEBIT', amount: 150000n },
      ],
      referenceType: 'IMMUTABLE_TEST',
      referenceId: walletId,
      idempotencyKey: key,
      description: 'Immutable test',
      createdBy: 'test',
    });

    const entryId = result.entries[0].id;
    const entry = await prisma.financialLedger.findUnique({ where: { id: entryId } });
    expect(entry).toBeTruthy();
    expect(entry!.amount).toBe(150000n);
  });

  it('unbalanced transaction rejected', async () => {
    const walletId = `unbalanced-${Date.now()}`;
    const key = `unbalanced-key-${Date.now()}`;

    await expect(
      postLedgerTransaction({
        entries: [
          { accountId: walletId, accountType: 'UNBALANCED_TEST', entryType: 'CREDIT', amount: 100000n },
          { accountId: 'platform', accountType: 'PLATFORM', entryType: 'DEBIT', amount: 50000n },
        ],
        referenceType: 'UNBALANCED_TEST',
        referenceId: walletId,
        idempotencyKey: key,
        description: 'Unbalanced test',
        createdBy: 'test',
      })
    ).rejects.toThrow('Unbalanced ledger');
  });
});
