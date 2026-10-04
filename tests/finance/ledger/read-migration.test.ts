import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  readCanonicalProviderBalance,
  readCanonicalCustomerBalance,
  reconcileWalletBalance,
} from '@/lib/financial-read';
import { requiresPostgres } from '../../helpers/test-guard';

const testPrefix = `read-mig-${Date.now()}`
const testProviderUserId = `${testPrefix}-prov`
const testCustomerUserId = `${testPrefix}-cust`
let testProviderWalletId: string
let testCustomerWalletId: string

describe.skipIf(!requiresPostgres())('Phase 5D — Canonical Financial Read Migration', () => {
  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        { id: testProviderUserId, email: `${testProviderUserId}@test.com`, passwordHash: 'hash', name: 'Test Provider', role: 'TASKER', isActive: true, updatedAt: new Date() },
        { id: testCustomerUserId, email: `${testCustomerUserId}@test.com`, passwordHash: 'hash', name: 'Test Customer', role: 'CUSTOMER', isActive: true, updatedAt: new Date() },
      ],
    })

    const provWallet = await prisma.providerWallet.create({
      data: { userId: testProviderUserId, availableBalance: 500, pendingBalance: 0 },
    })
    testProviderWalletId = provWallet.id

    const custWallet = await prisma.customerWallet.create({
      data: { userId: testCustomerUserId, balance: 300 },
    })
    testCustomerWalletId = custWallet.id

    await prisma.$executeRawUnsafe(
      `INSERT INTO "WalletBalance" ("id", "walletId", "walletType", "balance", "availableBalance", "pendingBalance", "version", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'PROVIDER', 50000, 50000, 0, 1, now(), now())
       ON CONFLICT ("walletType", "walletId", "currency") DO UPDATE SET "balance" = 50000, "availableBalance" = 50000, "updatedAt" = now()`,
      testProviderWalletId
    )

    await prisma.$executeRawUnsafe(
      `INSERT INTO "WalletBalance" ("id", "walletId", "walletType", "balance", "availableBalance", "pendingBalance", "version", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'CUSTOMER', 30000, 30000, 0, 1, now(), now())
       ON CONFLICT ("walletType", "walletId", "currency") DO UPDATE SET "balance" = 30000, "availableBalance" = 30000, "updatedAt" = now()`,
      testCustomerWalletId
    )

    const provLedgerId = `txn_${Date.now()}-prov-opening`
    await prisma.financialLedger.createMany({
      data: [
        {
          groupId: provLedgerId,
          accountId: `provider:${testProviderUserId}`,
          accountType: 'PROVIDER_WALLET',
          entryType: 'CREDIT',
          amount: 50000n,
          referenceType: 'OPENING_BALANCE',
          referenceId: `opening-${testProviderUserId}`,
          idempotencyKey: `opening-credit-${testProviderUserId}`,
          createdBy: 'system',
        },
        {
          groupId: provLedgerId,
          accountId: 'platform',
          accountType: 'PLATFORM',
          entryType: 'DEBIT',
          amount: 50000n,
          referenceType: 'OPENING_BALANCE',
          referenceId: `opening-${testProviderUserId}`,
          idempotencyKey: `opening-debit-${testProviderUserId}`,
          createdBy: 'system',
        },
      ],
    })

    const custLedgerId = `txn_${Date.now()}-cust-opening`
    await prisma.financialLedger.createMany({
      data: [
        {
          groupId: custLedgerId,
          accountId: `customer:${testCustomerUserId}`,
          accountType: 'CUSTOMER_WALLET',
          entryType: 'CREDIT',
          amount: 30000n,
          referenceType: 'OPENING_BALANCE',
          referenceId: `opening-${testCustomerUserId}`,
          idempotencyKey: `opening-credit-${testCustomerUserId}`,
          createdBy: 'system',
        },
        {
          groupId: custLedgerId,
          accountId: 'platform',
          accountType: 'PLATFORM',
          entryType: 'DEBIT',
          amount: 30000n,
          referenceType: 'OPENING_BALANCE',
          referenceId: `opening-${testCustomerUserId}`,
          idempotencyKey: `opening-debit-${testCustomerUserId}`,
          createdBy: 'system',
        },
      ],
    })
  })

  afterAll(async () => {
    await prisma.financialLedger.deleteMany({
      where: { referenceId: { in: [`opening-${testProviderUserId}`, `opening-${testCustomerUserId}`] } },
    })
    await prisma.$executeRawUnsafe(
      `DELETE FROM "WalletBalance" WHERE "walletId" IN ($1, $2)`,
      testProviderWalletId, testCustomerWalletId
    )
    await prisma.providerWallet.deleteMany({ where: { userId: testProviderUserId } })
    await prisma.customerWallet.deleteMany({ where: { userId: testCustomerUserId } })
    await prisma.user.deleteMany({ where: { id: { in: [testProviderUserId, testCustomerUserId] } } })
  })

  it('canonical provider balance matches legacy', async () => {
    const canonical = await readCanonicalProviderBalance(testProviderUserId)
    expect(canonical).toBeTruthy()
    expect(canonical!.balance).toBe(50000n)
  })

  it('canonical customer balance matches legacy', async () => {
    const canonical = await readCanonicalCustomerBalance(testCustomerUserId)
    expect(canonical).toBeTruthy()
    expect(canonical!.balance).toBe(30000n)
  })

  it('reconcileWalletBalance detects matches', async () => {
    const result = await reconcileWalletBalance(testProviderUserId, 'PROVIDER')
    expect(result.matched).toBe(true)
    expect(result.canonical).toBeTruthy()
    expect(result.legacy).toBeGreaterThan(0)
  })

  it('opening balance ledger entries exist with groupId', async () => {
    const entries = await prisma.financialLedger.findMany({
      where: { referenceType: 'OPENING_BALANCE', referenceId: `opening-${testProviderUserId}` },
    })
    expect(entries.length).toBe(2)

    const totalCredits = entries.filter(e => e.entryType === 'CREDIT').reduce((s, e) => s + e.amount, 0n)
    const totalDebits = entries.filter(e => e.entryType === 'DEBIT').reduce((s, e) => s + e.amount, 0n)
    expect(totalCredits).toBe(totalDebits)

    for (const entry of entries) {
      expect(entry.groupId).toBeTruthy()
    }
  })

  it('WalletBalance table has rows for test wallets', async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
      'SELECT count(*) as cnt FROM "WalletBalance" WHERE "walletId" IN ($1, $2)',
      testProviderWalletId, testCustomerWalletId
    )
    expect(Number(rows[0].cnt)).toBe(2)
  })
});
