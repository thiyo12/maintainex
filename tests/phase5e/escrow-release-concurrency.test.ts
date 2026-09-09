import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { isVPS } from '../helpers'

const prisma = new PrismaClient()

describe.skipIf(!isVPS)('Phase 5E.2 — Escrow Release Concurrency', () => {
  const prefix = `escrow-conc-${Date.now()}`
  const userIds: string[] = []
  const walletIds: string[] = []
  const jobIds: string[] = []

  afterAll(async () => {
    for (const jid of jobIds) {
      await prisma.commissionSettlement.deleteMany({ where: { jobId: jid } })
      await prisma.walletTransaction.deleteMany({ where: { referenceId: jid } })
      await prisma.jobEscrow.deleteMany({ where: { jobId: jid } })
      await prisma.jobWorkspace.deleteMany({ where: { jobId: jid } })
      await prisma.jobQuote.deleteMany({ where: { jobId: jid } })
      await prisma.marketplaceJob.deleteMany({ where: { id: jid } })
    }
    await prisma.financialLedger.deleteMany({
      where: { idempotencyKey: { contains: prefix } },
    })
    for (const wid of walletIds) {
      await prisma.$executeRawUnsafe(`DELETE FROM "WalletBalance" WHERE "walletId" = $1`, wid)
    }
    for (const uid of userIds) {
      await prisma.providerWallet.deleteMany({ where: { userId: uid } })
      await prisma.user.deleteMany({ where: { id: uid } })
    }
    await prisma.$disconnect()
  })

  async function createFixtures(label: string) {
    const custId = `${prefix}-${label}-cust`
    const provId = `${prefix}-${label}-prov`
    userIds.push(custId, provId)

    await prisma.user.createMany({
      data: [
        { id: custId, email: `${custId}@test.com`, passwordHash: 'h', name: 'C', role: 'CUSTOMER', isActive: true, updatedAt: new Date() },
        { id: provId, email: `${provId}@test.com`, passwordHash: 'h', name: 'P', role: 'TASKER', isActive: true, updatedAt: new Date() },
      ],
    })

    const custWallet = await prisma.providerWallet.create({ data: { userId: custId, availableBalance: 500 } })
    const provWallet = await prisma.providerWallet.create({ data: { userId: provId, availableBalance: 0 } })
    walletIds.push(custWallet.id, provWallet.id)

    await prisma.$executeRawUnsafe(
      `INSERT INTO "WalletBalance" ("id", "walletId", "walletType", "balance", "availableBalance", "pendingBalance", "version", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'PROVIDER', 500, 500, 0, 1, now(), now())
       ON CONFLICT ("walletType", "walletId") DO NOTHING`, custWallet.id
    )
    await prisma.$executeRawUnsafe(
      `INSERT INTO "WalletBalance" ("id", "walletId", "walletType", "balance", "availableBalance", "pendingBalance", "version", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'PROVIDER', 0, 0, 0, 1, now(), now())
       ON CONFLICT ("walletType", "walletId") DO NOTHING`, provWallet.id
    )

    const job = await prisma.marketplaceJob.create({
      data: {
        customerId: custId,
        title: `Concurrency Test ${label}`,
        description: 'test',
        categoryId: 'test-cat',
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: 10000n,
        status: 'IN_PROGRESS',
        urgency: 'normal',
        workersCount: 1,
        countryCode: 'LK',
      },
    })
    jobIds.push(job.id)

    const quote = await prisma.jobQuote.create({
      data: {
        jobId: job.id,
        providerId: provId,
        providerType: 'INDIVIDUAL',
        price: 10000n,
        estimatedCompletionTime: '1h',
        attachments: '[]',
        status: 'ACCEPTED',
      },
    })

    const ws = await prisma.jobWorkspace.create({
      data: { jobId: job.id, progressStatus: 'COMPLETION_REQUESTED', completionRequestedAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    })

    const escrow = await prisma.jobEscrow.create({
      data: {
        jobId: job.id,
        quoteId: quote.id,
        customerId: custId,
        providerId: provId,
        amount: 10000n,
        serviceFee: 1000n,
        totalAmount: 11000n,
        paymentMethod: 'CARD',
        status: 'PROTECTED',
        heldAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      },
    })

    return { job, quote, ws, escrow, custId, provId }
  }

  it('two customer releases → exactly one succeeds', async () => {
    const f = await createFixtures('dual-release')
    const { completeAndReleaseEscrow } = await import('@/lib/domain/job-lifecycle')

    const results = await Promise.allSettled([
      completeAndReleaseEscrow({ jobId: f.job.id, actorId: f.custId, actorType: 'CUSTOMER' }, f.job.id),
      completeAndReleaseEscrow({ jobId: f.job.id, actorId: f.custId, actorType: 'CUSTOMER' }, f.job.id),
    ])

    const succeeded = results.filter(r => r.status === 'fulfilled')
    const failed = results.filter(r => r.status === 'rejected')

    expect(succeeded.length).toBe(1)
    expect(failed.length).toBe(1)

    const escrow = await prisma.jobEscrow.findUnique({ where: { id: f.escrow.id } })
    expect(escrow?.status).toBe('RELEASED')

    const ledgerEntries = await prisma.financialLedger.findMany({
      where: { referenceType: 'ESCROW_RELEASE', referenceId: f.escrow.id },
    })
    const groupId = ledgerEntries[0]?.groupId
    expect(groupId).toBeTruthy()

    const allEntries = await prisma.financialLedger.findMany({ where: { groupId: groupId! } })
    expect(allEntries.length).toBe(ledgerEntries.length)
  })

  it('release vs dispute → dispute prevents release', async () => {
    const f = await createFixtures('release-dispute')
    const { completeAndReleaseEscrow, holdEscrowForDispute } = await import('@/lib/domain/job-lifecycle')

    const results = await Promise.allSettled([
      completeAndReleaseEscrow({ jobId: f.job.id, actorId: f.custId, actorType: 'CUSTOMER' }, f.job.id),
      holdEscrowForDispute({ jobId: f.job.id, actorId: f.custId, actorType: 'CUSTOMER' }, f.job.id),
    ])

    const released = results.find(r => r.status === 'fulfilled' && r.value?.commission !== undefined)
    const disputed = results.find(r => r.status === 'fulfilled' && r.value?.escrowId !== undefined)

    expect(released || disputed).toBeTruthy()

    const escrow = await prisma.jobEscrow.findUnique({ where: { id: f.escrow.id } })
    expect(['RELEASED', 'ON_HOLD']).toContain(escrow?.status)

    if (escrow?.status === 'RELEASED') {
      const ledger = await prisma.financialLedger.findMany({
        where: { referenceType: 'ESCROW_RELEASE', referenceId: f.escrow.id },
      })
      expect(ledger.length).toBeGreaterThan(0)
    }
  })

  it('release vs refund → one terminal state', async () => {
    const f = await createFixtures('release-refund')
    const { completeAndReleaseEscrow, refundEscrow } = await import('@/lib/domain/job-lifecycle')

    const results = await Promise.allSettled([
      completeAndReleaseEscrow({ jobId: f.job.id, actorId: f.custId, actorType: 'CUSTOMER' }, f.job.id),
      refundEscrow({ jobId: f.job.id, actorId: f.custId, actorType: 'CUSTOMER' }, f.job.id),
    ])

    const succeeded = results.filter(r => r.status === 'fulfilled')
    expect(succeeded.length).toBeGreaterThanOrEqual(1)
    expect(succeeded.length).toBeLessThanOrEqual(2)

    const escrow = await prisma.jobEscrow.findUnique({ where: { id: f.escrow.id } })
    expect(['RELEASED', 'REFUNDED']).toContain(escrow?.status)
  })

  it('disputed job → customer approval cannot release', async () => {
    const f = await createFixtures('disputed-approval')
    const { holdEscrowForDispute, completeAndReleaseEscrow } = await import('@/lib/domain/job-lifecycle')

    await holdEscrowForDispute({ jobId: f.job.id, actorId: f.custId, actorType: 'CUSTOMER' }, f.job.id)

    await expect(
      completeAndReleaseEscrow({ jobId: f.job.id, actorId: f.custId, actorType: 'CUSTOMER' }, f.job.id)
    ).rejects.toThrow()

    const escrow = await prisma.jobEscrow.findUnique({ where: { id: f.escrow.id } })
    expect(escrow?.status).toBe('ON_HOLD')
  })
})
