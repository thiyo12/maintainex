import { describe, it, expect } from 'vitest';
import { prisma } from '../../lib/prisma';
import { assertNotProductionDb } from '../test-guard';

assertNotProductionDb()

describe('Phase 5D — Opening Balance Cutover', () => {
  it('every WalletBalance row with balance > 0 has a matching OPENING_BALANCE credit', async () => {
    const wallets = await prisma.$queryRawUnsafe<Array<{
      walletId: string;
      walletType: string;
      balance: bigint;
    }>>(
      `SELECT "walletId", "walletType", balance FROM "WalletBalance" WHERE balance > 0`
    );

    if (wallets.length === 0) return;

    for (const wallet of wallets) {
      const credits = await prisma.$queryRawUnsafe<Array<{ amount: bigint }>>(
        `SELECT amount FROM "FinancialLedger"
         WHERE "accountId" = $1 AND "referenceType" = 'OPENING_BALANCE' AND "entryType" = 'CREDIT'`,
        wallet.walletId
      );
      expect(credits.length).toBeGreaterThanOrEqual(1);
      expect(credits[0].amount).toBe(wallet.balance);
    }
  });

  it('every OPENING_BALANCE credit has a matching DEBIT on OPENING_BALANCE_OFFSET', async () => {
    const credits = await prisma.$queryRawUnsafe<Array<{
      groupId: string;
      amount: bigint;
      referenceId: string;
    }>>(
      `SELECT "groupId", amount, "referenceId" FROM "FinancialLedger"
       WHERE "referenceType" = 'OPENING_BALANCE' AND "entryType" = 'CREDIT'
         AND "accountId" != 'OPENING_BALANCE_OFFSET'`
    );

    for (const credit of credits) {
      const debits = await prisma.$queryRawUnsafe<Array<{ amount: bigint }>>(
        `SELECT amount FROM "FinancialLedger"
         WHERE "groupId" = $1 AND "entryType" = 'DEBIT' AND "accountId" = 'OPENING_BALANCE_OFFSET'`,
        credit.groupId
      );
      expect(debits.length).toBe(1);
      expect(debits[0].amount).toBe(credit.amount);
    }
  });

  it('opening balance entries are double-entry balanced', async () => {
    const groups = await prisma.$queryRawUnsafe<Array<{
      groupId: string;
      totalCredits: bigint;
      totalDebits: bigint;
    }>>(
      `SELECT "groupId",
              SUM(CASE WHEN "entryType" = 'CREDIT' THEN amount ELSE 0 END) as "totalCredits",
              SUM(CASE WHEN "entryType" = 'DEBIT' THEN amount ELSE 0 END) as "totalDebits"
       FROM "FinancialLedger"
       WHERE "referenceType" = 'OPENING_BALANCE'
       GROUP BY "groupId"`
    );

    for (const group of groups) {
      expect(group.totalCredits).toBe(group.totalDebits);
      expect(group.totalCredits).toBeGreaterThan(0n);
    }
  });
});
