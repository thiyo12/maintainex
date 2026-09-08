import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  postLedgerTransaction,
  postWalletCredit,
  postWalletDebit,
  postEscrowDeposit,
  postEscrowRelease,
  postEscrowRefund,
  getLedgerBalance,
  getLedgerEntries,
} from '@/lib/ledger';
import { legacyToMinorUnits, lkrCents } from '@/lib/money';

describe('Ledger Posting', () => {
  describe('postLedgerTransaction', () => {
    it('posts balanced transaction', async () => {
      const result = await postLedgerTransaction({
        entries: [
          { accountId: 'test:wallet:1', accountType: 'TEST_WALLET', entryType: 'CREDIT', amount: 100000n },
          { accountId: 'test:platform', accountType: 'PLATFORM', entryType: 'DEBIT', amount: 100000n },
        ],
        referenceType: 'TEST',
        referenceId: 'test-ref-1',
        idempotencyKey: `test-balanced-${Date.now()}`,
        description: 'Test balanced transaction',
        createdBy: 'test',
      });

      expect(result.id).toBeTruthy();
      expect(result.entries).toHaveLength(2);
    });

    it('rejects unbalanced transaction', async () => {
      await expect(
        postLedgerTransaction({
          entries: [
            { accountId: 'test:wallet:1', accountType: 'TEST_WALLET', entryType: 'CREDIT', amount: 100000n },
            { accountId: 'test:platform', accountType: 'PLATFORM', entryType: 'DEBIT', amount: 50000n },
          ],
          referenceType: 'TEST',
          referenceId: 'test-ref-2',
          idempotencyKey: `test-unbalanced-${Date.now()}`,
          description: 'Test unbalanced transaction',
          createdBy: 'test',
        })
      ).rejects.toThrow('Unbalanced ledger');
    });

    it('rejects single entry', async () => {
      await expect(
        postLedgerTransaction({
          entries: [
            { accountId: 'test:wallet:1', accountType: 'TEST_WALLET', entryType: 'CREDIT', amount: 100000n },
          ],
          referenceType: 'TEST',
          referenceId: 'test-ref-3',
          idempotencyKey: `test-single-${Date.now()}`,
          description: 'Test single entry',
          createdBy: 'test',
        })
      ).rejects.toThrow('at least 2 entries');
    });

    it('rejects zero amount', async () => {
      await expect(
        postLedgerTransaction({
          entries: [
            { accountId: 'test:wallet:1', accountType: 'TEST_WALLET', entryType: 'CREDIT', amount: 0n },
            { accountId: 'test:platform', accountType: 'PLATFORM', entryType: 'DEBIT', amount: 0n },
          ],
          referenceType: 'TEST',
          referenceId: 'test-ref-4',
          idempotencyKey: `test-zero-${Date.now()}`,
          description: 'Test zero amount',
          createdBy: 'test',
        })
      ).rejects.toThrow('non-zero amounts');
    });

    it('handles idempotent duplicate', async () => {
      const key = `test-idempotent-${Date.now()}`;
      const input = {
        entries: [
          { accountId: 'test:wallet:2', accountType: 'TEST_WALLET', entryType: 'CREDIT' as const, amount: 50000n },
          { accountId: 'test:platform', accountType: 'PLATFORM', entryType: 'DEBIT' as const, amount: 50000n },
        ],
        referenceType: 'TEST',
        referenceId: 'test-idempotent-ref',
        idempotencyKey: key,
        description: 'Test idempotent',
        createdBy: 'test',
      };

      const first = await postLedgerTransaction(input);
      const second = await postLedgerTransaction(input);

      expect(first.id).toBe(second.id);
      expect(first.entries.length).toBe(second.entries.length);
      for (let i = 0; i < first.entries.length; i++) {
        expect(first.entries[i].accountId).toBe(second.entries[i].accountId);
        expect(first.entries[i].entryType).toBe(second.entries[i].entryType);
        expect(BigInt(first.entries[i].amount)).toBe(BigInt(second.entries[i].amount));
      }
    });
  });

  describe('Wallet operations', () => {
    it('posts wallet credit', async () => {
      const result = await postWalletCredit(
        'test-pw-1',
        'PROVIDER_WALLET',
        100000n,
        'TEST_CREDIT',
        `test-credit-${Date.now()}`,
        `test-credit-key-${Date.now()}`,
        'test'
      );

      expect(result.entries).toHaveLength(2);
    });

    it('posts wallet debit', async () => {
      const result = await postWalletDebit(
        'test-pw-2',
        'PROVIDER_WALLET',
        50000n,
        'TEST_DEBIT',
        `test-debit-${Date.now()}`,
        `test-debit-key-${Date.now()}`,
        'test'
      );

      expect(result.entries).toHaveLength(2);
    });
  });

  describe('Escrow operations', () => {
    it('posts escrow deposit', async () => {
      const result = await postEscrowDeposit(
        'test-escrow-1',
        'test-customer-1',
        500000n,
        `test-deposit-${Date.now()}`
      );

      expect(result.entries).toHaveLength(2);
    });

    it('posts escrow release with commission', async () => {
      const result = await postEscrowRelease(
        'test-escrow-2',
        'test-provider-1',
        500000n,
        50000n,
        `test-release-${Date.now()}`
      );

      expect(result.entries).toHaveLength(3);
    });

    it('posts escrow refund', async () => {
      const result = await postEscrowRefund(
        'test-escrow-3',
        'test-customer-2',
        300000n,
        `test-refund-${Date.now()}`
      );

      expect(result.entries).toHaveLength(2);
    });
  });

  describe('Balance computation', () => {
    it('computes balance from ledger', async () => {
      const accountId = `test-balance-${Date.now()}`;
      await postWalletCredit(accountId, 'TEST_WALLET', 100000n, 'TEST', `ref-${Date.now()}`, `key-${Date.now()}`, 'test');
      await postWalletDebit(accountId, 'TEST_WALLET', 30000n, 'TEST', `ref2-${Date.now()}`, `key2-${Date.now()}`, 'test');

      const balance = await getLedgerBalance(accountId, 'TEST_WALLET');
      expect(balance.credits).toBe(100000n);
      expect(balance.debits).toBe(30000n);
      expect(balance.balance).toBe(70000n);
    });
  });

  describe('Legacy conversion', () => {
    it('converts legacy whole number', () => {
      const minor = legacyToMinorUnits(5000);
      expect(minor).toBe(500000n);
    });

    it('converts legacy zero', () => {
      const minor = legacyToMinorUnits(0);
      expect(minor).toBe(0n);
    });
  });
});
