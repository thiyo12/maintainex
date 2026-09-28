import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  postLedgerTransaction,
  postWalletCredit,
  postWalletDebit,
  postEscrowDeposit,
  postEscrowRelease,
  postEscrowRefund,
  getLedgerBalance,
} from '@/lib/ledger';
import { legacyToMinorUnits } from '@/lib/money';
import { isPostgres, requiresPostgres } from '../../helpers/test-guard';

async function ensureWalletBalance(walletId: string, walletType: string, balance: number) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "WalletBalance" ("id", "walletId", "walletType", "balance", "availableBalance", "pendingBalance", "version", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $4, 0, 1, now(), now())
     ON CONFLICT ("walletType", "walletId")
     DO UPDATE SET "balance" = $4, "availableBalance" = $4, "updatedAt" = now()`,
    `wb-${walletId}`, walletId, walletType, balance
  )
}

async function ensureUser(id: string, role: string) {
  await prisma.user.upsert({
    where: { id },
    update: {},
    create: {
      id,
      email: `${id}@ledger.test`,
      passwordHash: 'test-hash',
      name: id,
      role,
    },
  })
}

async function ensureCustomerWallet(userId: string, majorBalance: number) {
  await ensureUser(userId, 'CUSTOMER')
  const wallet = await prisma.customerWallet.upsert({
    where: { userId },
    update: { balance: majorBalance },
    create: { id: userId, userId, balance: majorBalance },
  })
  await ensureWalletBalance(wallet.id, 'CUSTOMER', majorBalance)
}

async function ensureProviderWallet(userId: string, majorBalance: number) {
  await ensureUser(userId, 'TASKER')
  const wallet = await prisma.providerWallet.upsert({
    where: { userId },
    update: { availableBalance: majorBalance },
    create: { id: userId, userId, availableBalance: majorBalance, pendingBalance: 0 },
  })
  await ensureWalletBalance(wallet.id, 'PROVIDER', majorBalance)
}

describe.skipIf(!requiresPostgres())('Ledger Posting', () => {
  beforeAll(async () => {
    if (isPostgres) {
      await ensureWalletBalance('test-pw-1', 'PROVIDER', 200000)
      await ensureWalletBalance('test-pw-2', 'PROVIDER', 200000)
      await ensureCustomerWallet('test-customer-1', 1000000)
      await ensureCustomerWallet('test-customer-2', 1000000)
      await ensureProviderWallet('test-provider-1', 200000)
    }
  })

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
      await expect(postLedgerTransaction({
        entries: [
          { accountId: 'test:wallet:1', accountType: 'TEST_WALLET', entryType: 'CREDIT', amount: 100000n },
          { accountId: 'test:platform', accountType: 'PLATFORM', entryType: 'DEBIT', amount: 50000n },
        ],
        referenceType: 'TEST',
        referenceId: 'test-ref-2',
        idempotencyKey: `test-unbalanced-${Date.now()}`,
        createdBy: 'test',
      })).rejects.toThrow('Unbalanced ledger');
    });

    it('rejects single entry', async () => {
      await expect(postLedgerTransaction({
        entries: [{ accountId: 'test:wallet:1', accountType: 'TEST_WALLET', entryType: 'CREDIT', amount: 100000n }],
        referenceType: 'TEST', referenceId: 'test-ref-3', idempotencyKey: `test-single-${Date.now()}`, createdBy: 'test',
      })).rejects.toThrow('at least 2 entries');
    });

    it('rejects zero amount', async () => {
      await expect(postLedgerTransaction({
        entries: [
          { accountId: 'test:wallet:1', accountType: 'TEST_WALLET', entryType: 'CREDIT', amount: 0n },
          { accountId: 'test:platform', accountType: 'PLATFORM', entryType: 'DEBIT', amount: 0n },
        ],
        referenceType: 'TEST', referenceId: 'test-ref-4', idempotencyKey: `test-zero-${Date.now()}`, createdBy: 'test',
      })).rejects.toThrow('non-zero amounts');
    });

    it('handles idempotent duplicate', async () => {
      const key = `test-idempotent-${Date.now()}`;
      const input = {
        entries: [
          { accountId: 'test:wallet:2', accountType: 'TEST_WALLET', entryType: 'CREDIT' as const, amount: 50000n },
          { accountId: 'test:platform', accountType: 'PLATFORM', entryType: 'DEBIT' as const, amount: 50000n },
        ],
        referenceType: 'TEST', referenceId: 'test-idempotent-ref', idempotencyKey: key, createdBy: 'test',
      };
      const first = await postLedgerTransaction(input);
      const second = await postLedgerTransaction(input);
      expect(first.id).toBe(second.id);
      expect(first.entries.length).toBe(second.entries.length);
    });
  });

  describe('Wallet operations', () => {
    it('posts wallet credit', async () => {
      const result = await postWalletCredit('test-pw-1', 'PROVIDER_WALLET', 100000n, 'TEST_CREDIT', `test-credit-${Date.now()}`, `test-credit-key-${Date.now()}`, 'test');
      expect(result.entries).toHaveLength(2);
    });

    it('posts wallet debit', async () => {
      const result = await postWalletDebit('test-pw-2', 'PROVIDER_WALLET', 50000n, 'TEST_DEBIT', `test-debit-${Date.now()}`, `test-debit-key-${Date.now()}`, 'test');
      expect(result.entries).toHaveLength(2);
    });
  });

  describe('Escrow operations', () => {
    it('posts escrow deposit', async () => {
      const result = await postEscrowDeposit('test-escrow-1', 'test-customer-1', 500000n, `test-deposit-${Date.now()}`);
      expect(result.entries).toHaveLength(2);
    });

    it('posts escrow release with commission', async () => {
      const result = await postEscrowRelease('test-escrow-2', 'test-provider-1', 500000n, 50000n, `test-release-${Date.now()}`);
      expect(result.entries).toHaveLength(3);
    });

    it('posts escrow refund', async () => {
      const result = await postEscrowRefund('test-escrow-3', 'test-customer-2', 300000n, `test-refund-${Date.now()}`);
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
    it('converts legacy whole number', () => expect(legacyToMinorUnits(5000)).toBe(500000n));
    it('converts legacy zero', () => expect(legacyToMinorUnits(0)).toBe(0n));
  });
});
