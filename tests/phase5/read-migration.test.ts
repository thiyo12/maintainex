import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  readCanonicalProviderBalance,
  readCanonicalCustomerBalance,
  readLegacyProviderBalance,
  readLegacyCustomerBalance,
  reconcileWalletBalance,
} from '@/lib/financial-read';
import { assertNotProductionDb } from '../test-guard';

assertNotProductionDb()

describe('Phase 5D — Canonical Financial Read Migration', () => {
  it('canonical provider balance matches legacy', async () => {
    const wallets = await prisma.providerWallet.findMany({
      where: { availableBalance: { gt: 0 } },
      take: 5,
    });

    for (const wallet of wallets) {
      const canonical = await readCanonicalProviderBalance(wallet.userId);
      const legacy = await readLegacyProviderBalance(wallet.userId);

      expect(canonical).toBeTruthy();
      expect(legacy).toBeTruthy();

      if (canonical && legacy !== null) {
        const legacyMinor = BigInt(Math.round(legacy * 100));
        expect(canonical.balance).toBe(legacyMinor);
      }
    }
  });

  it('canonical customer balance matches legacy', async () => {
    const wallets = await prisma.customerWallet.findMany({
      where: { balance: { gt: 0 } },
      take: 5,
    });

    for (const wallet of wallets) {
      const canonical = await readCanonicalCustomerBalance(wallet.userId);
      const legacy = await readLegacyCustomerBalance(wallet.userId);

      expect(canonical).toBeTruthy();
      expect(legacy).toBeTruthy();

      if (canonical && legacy !== null) {
        const legacyMinor = BigInt(Math.round(legacy * 100));
        expect(canonical.balance).toBe(legacyMinor);
      }
    }
  });

  it('reconcileWalletBalance detects matches', async () => {
    const wallet = await prisma.providerWallet.findFirst({
      where: { availableBalance: { gt: 0 } },
    });
    if (!wallet) return;

    const result = await reconcileWalletBalance(wallet.userId, 'PROVIDER');
    expect(result.matched).toBe(true);
    expect(result.canonical).toBeTruthy();
    expect(result.legacy).toBeGreaterThan(0);
  });

  it('opening balance ledger entries exist for all wallets', async () => {
    const providerCount = await prisma.providerWallet.count({
      where: { availableBalance: { gt: 0 } },
    });
    const customerCount = await prisma.customerWallet.count({
      where: { balance: { gt: 0 } },
    });

    const ledgerCount = await prisma.financialLedger.count({
      where: { referenceType: 'OPENING_BALANCE' },
    });

    expect(ledgerCount).toBe((providerCount + customerCount) * 2);
  });

  it('WalletBalance table has correct row count', async () => {
    const providerCount = await prisma.providerWallet.count({
      where: { availableBalance: { gt: 0 } },
    });
    const customerCount = await prisma.customerWallet.count({
      where: { balance: { gt: 0 } },
    });

    const rows = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
      'SELECT count(*) as cnt FROM "WalletBalance"'
    );
    const walletBalanceCount = Number(rows[0].cnt);
    expect(walletBalanceCount).toBeGreaterThanOrEqual(providerCount + customerCount);
  });
});
