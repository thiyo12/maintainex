import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { assertNotProductionDb } from '../test-guard';

const prisma = new PrismaClient();
assertNotProductionDb();

describe('Phase 5D — Opening Balance Cutover', () => {
  const prefix = `cutover-${Date.now()}`;
  const customerWalletId = `${prefix}-cust-wallet`;
  const providerWalletId = `${prefix}-prov-wallet`;
  const zeroWalletId = `${prefix}-zero-wallet`;
  const preExistingWalletId = `${prefix}-preexist-wallet`;
  const customerUserId = `${prefix}-cust-user`;
  const providerUserId = `${prefix}-prov-user`;
  const zeroUserId = `${prefix}-zero-user`;
  const preExistingUserId = `${prefix}-preexist-user`;

  afterAll(async () => {
    await prisma.financialLedger.deleteMany({ where: { referenceType: 'OPENING_BALANCE', idempotencyKey: { contains: prefix } } });
    await prisma.walletBalance.deleteMany({ where: { walletId: { contains: prefix } } });
    await prisma.customerWallet.deleteMany({ where: { id: { in: [customerWalletId, zeroWalletId, preExistingWalletId] } } });
    await prisma.providerWallet.deleteMany({ where: { id: providerWalletId } });
    await prisma.user.deleteMany({ where: { id: { in: [customerUserId, providerUserId, zeroUserId, preExistingUserId] } } });
    await prisma.$disconnect();
  });

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        { id: customerUserId, email: `${customerUserId}@test.com`, passwordHash: 'h', name: 'Cust', role: 'CUSTOMER', isActive: true, updatedAt: new Date() },
        { id: providerUserId, email: `${providerUserId}@test.com`, passwordHash: 'h', name: 'Prov', role: 'TASKER', isActive: true, updatedAt: new Date() },
        { id: zeroUserId, email: `${zeroUserId}@test.com`, passwordHash: 'h', name: 'Zero', role: 'CUSTOMER', isActive: true, updatedAt: new Date() },
        { id: preExistingUserId, email: `${preExistingUserId}@test.com`, passwordHash: 'h', name: 'PreExist', role: 'CUSTOMER', isActive: true, updatedAt: new Date() },
      ],
    });

    await prisma.customerWallet.create({ data: { id: customerWalletId, userId: customerUserId, balance: 500 } });
    await prisma.providerWallet.create({ data: { id: providerWalletId, userId: providerUserId, availableBalance: 0 } });
    await prisma.customerWallet.create({ data: { id: zeroWalletId, userId: zeroUserId, balance: 0 } });
    await prisma.customerWallet.create({ data: { id: preExistingWalletId, userId: preExistingUserId, balance: 200 } });

    await prisma.$executeRawUnsafe(
      `INSERT INTO "WalletBalance" ("id", "walletId", "walletType", "balance", "availableBalance", "pendingBalance", "version", "createdAt", "updatedAt")
       VALUES ($1, $2, 'CUSTOMER', 50000, 50000, 0, 1, now(), now())
       ON CONFLICT ("walletType", "walletId") DO UPDATE SET "balance" = 50000, "availableBalance" = 50000`,
      `${prefix}-cust-wb`, customerWalletId
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "WalletBalance" ("id", "walletId", "walletType", "balance", "availableBalance", "pendingBalance", "version", "createdAt", "updatedAt")
       VALUES ($1, $2, 'PROVIDER', 30000, 30000, 0, 1, now(), now())
       ON CONFLICT ("walletType", "walletId") DO UPDATE SET "balance" = 30000, "availableBalance" = 30000`,
      `${prefix}-prov-wb`, providerWalletId
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "WalletBalance" ("id", "walletId", "walletType", "balance", "availableBalance", "pendingBalance", "version", "createdAt", "updatedAt")
       VALUES ($1, $2, 'CUSTOMER', 0, 0, 0, 1, now(), now())
       ON CONFLICT ("walletType", "walletId") DO UPDATE SET "balance" = 0, "availableBalance" = 0`,
      `${prefix}-zero-wb`, zeroWalletId
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "WalletBalance" ("id", "walletId", "walletType", "balance", "availableBalance", "pendingBalance", "version", "createdAt", "updatedAt")
       VALUES ($1, $2, 'CUSTOMER', 20000, 20000, 0, 1, now(), now())
       ON CONFLICT ("walletType", "walletId") DO UPDATE SET "balance" = 20000, "availableBalance" = 20000`,
      `${prefix}-preexist-wb`, preExistingWalletId
    );

    await prisma.financialLedger.create({
      data: {
        groupId: `opening_${preExistingWalletId}`,
        accountId: preExistingWalletId,
        accountType: 'CUSTOMER_WALLET',
        entryType: 'CREDIT',
        amount: 20000n,
        currency: 'LKR',
        referenceType: 'OPENING_BALANCE',
        referenceId: `opening-${preExistingWalletId}`,
        idempotencyKey: `opening-balance-${preExistingWalletId}-1`,
        description: 'Pre-existing opening entry',
        createdBy: 'system',
      },
    });
    await prisma.financialLedger.create({
      data: {
        groupId: `opening_${preExistingWalletId}`,
        accountId: 'OPENING_BALANCE_OFFSET',
        accountType: 'OPENING_BALANCE_OFFSET',
        entryType: 'DEBIT',
        amount: 20000n,
        currency: 'LKR',
        referenceType: 'OPENING_BALANCE',
        referenceId: `opening-${preExistingWalletId}`,
        idempotencyKey: `opening-balance-offset-${preExistingWalletId}-1`,
        description: 'Pre-existing opening offset',
        createdBy: 'system',
      },
    });
  });

  async function executeCutover() {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "FinancialLedger" (
        "id", "groupId", "accountId", "accountType", "entryType",
        "amount", "currency", "referenceType", "referenceId",
        "idempotencyKey", "description", "createdBy", "createdAt"
      )
      SELECT
        gen_random_uuid()::text,
        'opening_' || wb."walletId",
        wb."walletId",
        CASE wb."walletType" WHEN 'CUSTOMER' THEN 'CUSTOMER_WALLET' WHEN 'PROVIDER' THEN 'PROVIDER_WALLET' ELSE wb."walletType" || '_WALLET' END,
        'CREDIT',
        wb."balance",
        'LKR',
        'OPENING_BALANCE',
        'opening-' || wb."walletId",
        'opening-balance-' || wb."walletId" || '-' || wb."version",
        'Opening balance cutover from WalletBalance snapshot',
        'system',
        CURRENT_TIMESTAMP
      FROM "WalletBalance" wb
      WHERE wb."balance" > 0
        AND NOT EXISTS (
          SELECT 1 FROM "FinancialLedger" fl
          WHERE fl."referenceType" = 'OPENING_BALANCE'
            AND fl."referenceId" = 'opening-' || wb."walletId"
            AND fl."entryType" = 'CREDIT'
        )
      ON CONFLICT ("idempotencyKey") DO NOTHING
    `);

    await prisma.$executeRawUnsafe(`
      INSERT INTO "FinancialLedger" (
        "id", "groupId", "accountId", "accountType", "entryType",
        "amount", "currency", "referenceType", "referenceId",
        "idempotencyKey", "description", "createdBy", "createdAt"
      )
      SELECT
        gen_random_uuid()::text,
        'opening_' || wb."walletId",
        'OPENING_BALANCE_OFFSET',
        'OPENING_BALANCE_OFFSET',
        'DEBIT',
        wb."balance",
        'LKR',
        'OPENING_BALANCE',
        'opening-' || wb."walletId",
        'opening-balance-offset-' || wb."walletId" || '-' || wb."version",
        'Opening balance offset for WalletBalance snapshot',
        'system',
        CURRENT_TIMESTAMP
      FROM "WalletBalance" wb
      WHERE wb."balance" > 0
        AND NOT EXISTS (
          SELECT 1 FROM "FinancialLedger" fl
          WHERE fl."referenceType" = 'OPENING_BALANCE'
            AND fl."referenceId" = 'opening-' || wb."walletId"
            AND fl."entryType" = 'DEBIT'
        )
      ON CONFLICT ("idempotencyKey") DO NOTHING
    `);
  }

  it('customer wallet: positive balance gets opening CREDIT', async () => {
    await executeCutover();

    const credits = await prisma.$queryRawUnsafe<Array<{ amount: bigint; accountType: string }>>(
      `SELECT amount, "accountType" FROM "FinancialLedger"
       WHERE "accountId" = $1 AND "referenceType" = 'OPENING_BALANCE' AND "entryType" = 'CREDIT'`,
      customerWalletId
    );
    expect(credits.length).toBe(1);
    expect(credits[0].amount).toBe(50000n);
    expect(credits[0].accountType).toBe('CUSTOMER_WALLET');
  });

  it('provider wallet: positive balance gets opening CREDIT', async () => {
    const credits = await prisma.$queryRawUnsafe<Array<{ amount: bigint; accountType: string }>>(
      `SELECT amount, "accountType" FROM "FinancialLedger"
       WHERE "accountId" = $1 AND "referenceType" = 'OPENING_BALANCE' AND "entryType" = 'CREDIT'`,
      providerWalletId
    );
    expect(credits.length).toBe(1);
    expect(credits[0].amount).toBe(30000n);
    expect(credits[0].accountType).toBe('PROVIDER_WALLET');
  });

  it('zero balance wallet: no opening entry created', async () => {
    const entries = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "FinancialLedger"
       WHERE "accountId" = $1 AND "referenceType" = 'OPENING_BALANCE'`,
      zeroWalletId
    );
    expect(entries.length).toBe(0);
  });

  it('already-migrated wallet: no duplicate entry (pre-existing CREDIT preserved)', async () => {
    const credits = await prisma.$queryRawUnsafe<Array<{ amount: bigint; idempotencyKey: string }>>(
      `SELECT amount, "idempotencyKey" FROM "FinancialLedger"
       WHERE "accountId" = $1 AND "referenceType" = 'OPENING_BALANCE' AND "entryType" = 'CREDIT'`,
      preExistingWalletId
    );
    expect(credits.length).toBe(1);
    expect(credits[0].amount).toBe(20000n);
    expect(credits[0].idempotencyKey).toBe(`opening-balance-${preExistingWalletId}-1`);
  });

  it('double-entry balanced: each wallet has matching CREDIT + DEBIT on same groupId', async () => {
    const wallets = [customerWalletId, providerWalletId];
    for (const walletId of wallets) {
      const group = await prisma.$queryRawUnsafe<Array<{ groupId: string; totalCredits: bigint; totalDebits: bigint }>>(
        `SELECT "groupId",
                SUM(CASE WHEN "entryType" = 'CREDIT' THEN amount ELSE 0 END) as "totalCredits",
                SUM(CASE WHEN "entryType" = 'DEBIT' THEN amount ELSE 0 END) as "totalDebits"
         FROM "FinancialLedger"
         WHERE "referenceType" = 'OPENING_BALANCE' AND "referenceId" = $1
         GROUP BY "groupId"`,
        `opening-${walletId}`
      );
      expect(group.length).toBe(1);
      expect(BigInt(group[0].totalCredits)).toBe(BigInt(group[0].totalDebits));
      expect(BigInt(group[0].totalCredits)).toBeGreaterThan(0n);
    }
  });

  it('offset DEBIT uses correct accountType', async () => {
    const offsetDebits = await prisma.$queryRawUnsafe<Array<{ accountType: string; accountId: string }>>(
      `SELECT "accountType", "accountId" FROM "FinancialLedger"
       WHERE "referenceType" = 'OPENING_BALANCE' AND "entryType" = 'DEBIT'
         AND "accountId" = 'OPENING_BALANCE_OFFSET'`
    );
    for (const debit of offsetDebits) {
      expect(debit.accountType).toBe('OPENING_BALANCE_OFFSET');
    }
  });

  it('idempotency: rerun cutover produces no duplicate entries', async () => {
    const countBefore = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM "FinancialLedger" WHERE "referenceType" = 'OPENING_BALANCE'`
    );
    const before = Number(countBefore[0].count);

    await executeCutover();

    const countAfter = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM "FinancialLedger" WHERE "referenceType" = 'OPENING_BALANCE'`
    );
    const after = Number(countAfter[0].count);
    expect(after).toBe(before);
  });
});
