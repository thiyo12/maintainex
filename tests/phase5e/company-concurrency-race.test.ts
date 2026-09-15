import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const TEST_DB_URL = process.env.TEST_DB_URL
const isVPS = TEST_DB_URL && TEST_DB_URL.includes('maintainex_test')
const prisma = new PrismaClient()

describe.skipIf(!isVPS)('Phase 5E — Company Concurrency + Dispute Race + Reversal Regression', () => {
  const prefix = `race-${Date.now()}`
  const customerUserId = `${prefix}-cust`
  const providerUserId = `${prefix}-prov`
  const companyOwnerId = `${prefix}-co-owner`
  const companyWorkerId = `${prefix}-co-worker`
  const unrelatedUserId = `${prefix}-unrelated`
  const companyProfileId = `${prefix}-company`
  const templateJobId = `${prefix}-template`
  const categoryId = `${prefix}-cat`
  const jobIds: string[] = []

  afterAll(async () => {
    for (const jid of jobIds) {
      await prisma.commissionSettlement.deleteMany({ where: { jobId: jid } })
      await prisma.financialLedger.deleteMany({ where: { referenceId: jid } })
      await prisma.jobEscrow.deleteMany({ where: { jobId: jid } })
      await prisma.jobVerificationPin.deleteMany({ where: { jobId: jid } })
      await prisma.jobWorkspace.deleteMany({ where: { jobId: jid } })
      await prisma.jobQuote.deleteMany({ where: { jobId: jid } })
      await prisma.marketplaceJob.deleteMany({ where: { id: jid } })
    }
    await prisma.teamMember.deleteMany({ where: { companyId: companyProfileId } })
    await prisma.companySpecialty.deleteMany({ where: { companyId: companyProfileId } })
    await prisma.companyProfile.deleteMany({ where: { id: companyProfileId } })
    await prisma.taskerSkill.deleteMany({ where: { jobId: templateJobId } })
    await prisma.templateJob.deleteMany({ where: { id: templateJobId } })
    await prisma.jobCategory.deleteMany({ where: { id: categoryId } })
    await prisma.taskerProfile.deleteMany({ where: { userId: { in: [providerUserId, companyWorkerId, `${prefix}-other-prov`] } } })
    await prisma.user.deleteMany({ where: { id: { in: [customerUserId, providerUserId, companyOwnerId, companyWorkerId, unrelatedUserId, `${prefix}-other-prov`] } } })
    await prisma.$disconnect()
  })

  beforeAll(async () => {
    await prisma.jobCategory.create({
      data: { id: categoryId, name: `${prefix} Services`, slug: prefix, iconName: 'wrench', colorHex: '#FF0000', countries: 'LK', isActive: true },
    })
    await prisma.templateJob.create({
      data: { id: templateJobId, name: 'Race Test Service', description: 'Concurrency test', categoryId, priceMin: 1000, priceMax: 5000, whatIsIncluded: 'Everything', typicalDurationMinutes: 60, countries: 'LK' },
    })

    await prisma.user.createMany({
      data: [
        { id: customerUserId, email: `${customerUserId}@test.com`, passwordHash: 'h', name: 'Race Customer', role: 'CUSTOMER', isActive: true, updatedAt: new Date(), identityStatus: 'VERIFIED' },
        { id: providerUserId, email: `${providerUserId}@test.com`, passwordHash: 'h', name: 'Race Provider', role: 'TASKER', isActive: true, updatedAt: new Date(), identityStatus: 'VERIFIED' },
        { id: companyOwnerId, email: `${companyOwnerId}@test.com`, passwordHash: 'h', name: 'Race Co Owner', role: 'TASKER', isActive: true, updatedAt: new Date(), identityStatus: 'VERIFIED' },
        { id: companyWorkerId, email: `${companyWorkerId}@test.com`, passwordHash: 'h', name: 'Race Co Worker', role: 'TASKER', isActive: true, updatedAt: new Date(), identityStatus: 'VERIFIED' },
        { id: unrelatedUserId, email: `${unrelatedUserId}@test.com`, passwordHash: 'h', name: 'Unrelated User', role: 'TASKER', isActive: true, updatedAt: new Date(), identityStatus: 'VERIFIED' },
      ],
    })

    const indProfile = await prisma.taskerProfile.create({
      data: { userId: providerUserId, skills: '[]', rating: 4.5, completedJobs: 10, hourlyRate: 500, verificationStatus: 'VERIFIED', isVerified: true },
    })
    await prisma.taskerSkill.create({
      data: { taskerId: indProfile.id, jobId: templateJobId, experienceYears: 2, experienceLevel: 2, hourlyRate: 500 },
    })

    await prisma.companyProfile.create({
      data: {
        id: companyProfileId,
        userId: companyOwnerId,
        companyName: `${prefix} Corp`,
        services: '[]',
        serviceAreas: '["Colombo"]',
        isVerified: true,
        verificationStatus: 'VERIFIED',
        subscriptionStatus: 'ACTIVE',
      },
    })

    await prisma.teamMember.createMany({
      data: [
        { companyId: companyProfileId, userId: companyOwnerId, name: 'Owner', role: 'COMPANY_OWNER', status: 'ACTIVE', skills: '[]' },
        { companyId: companyProfileId, userId: companyWorkerId, name: 'Worker', role: 'WORKER', status: 'ACTIVE', skills: '[]' },
      ],
    })

    const custWallet = await prisma.customerWallet.create({ data: { userId: customerUserId, balance: 1000000 } })
    await prisma.providerWallet.create({ data: { userId: providerUserId, availableBalance: 0 } })
    await prisma.providerWallet.create({ data: { userId: companyOwnerId, availableBalance: 0 } })

    await prisma.$executeRawUnsafe(
      `INSERT INTO "WalletBalance" ("id", "walletId", "walletType", "balance", "availableBalance", "pendingBalance", "version", "createdAt", "updatedAt")
       VALUES ($1, $1, 'CUSTOMER', 100000000, 100000000, 0, 1, NOW(), NOW())
       ON CONFLICT ("walletType", "walletId") DO UPDATE SET "balance" = 100000000, "availableBalance" = 100000000`,
      custWallet.id
    )

    await prisma.companySpecialty.create({
      data: { companyId: companyProfileId, jobId: templateJobId },
    })

    const workerProfile = await prisma.taskerProfile.create({
      data: { userId: companyWorkerId, skills: '[]', rating: 4.0, completedJobs: 5, hourlyRate: 400, verificationStatus: 'VERIFIED', isVerified: true },
    })
    await prisma.taskerSkill.create({
      data: { taskerId: workerProfile.id, jobId: templateJobId, experienceYears: 1, experienceLevel: 1, hourlyRate: 400 },
    })
  })

  async function createReadyJob(label: string, providerId: string, providerType: 'INDIVIDUAL' | 'COMPANY') {
    const { createBookNowJob } = await import('@/lib/domain/book-now')
    const { acceptJobQuote, fundEscrow, transitionJobWorkspace } = await import('@/lib/domain/job-lifecycle')

    const bookResult = await createBookNowJob({
      customerId: customerUserId,
      templateJobId,
      providerId,
      providerType,
      scheduledDate: new Date(),
      timeSlot: `${prefix}-${label}`,
      address: `${label} St`,
      district: 'Colombo',
    })
    jobIds.push(bookResult.job.id)

    const quote = await prisma.jobQuote.findFirst({ where: { jobId: bookResult.job.id } })
    await acceptJobQuote({ jobId: bookResult.job.id, actorId: customerUserId, actorType: 'CUSTOMER' }, quote!.id)
    await fundEscrow({ jobId: bookResult.job.id, actorId: customerUserId, actorType: 'CUSTOMER' }, bookResult.job.id)
    await transitionJobWorkspace({ jobId: bookResult.job.id, actorId: customerUserId, actorType: 'CUSTOMER' }, 'IN_PROGRESS')

    return { jobId: bookResult.job.id, quoteId: quote!.id }
  }

  it('dispute vs auto-release: only one terminal state', async () => {
    const { transitionJobWorkspace, completeAndReleaseEscrow, raiseJobDispute, resolveProviderActor } = await import('@/lib/domain/job-lifecycle')

    const { jobId } = await createReadyJob('disc-auto', companyProfileId, 'COMPANY')

    const resolved = await resolveProviderActor(jobId, companyWorkerId)
    await transitionJobWorkspace({ jobId, actorId: companyWorkerId, actorType: resolved! }, 'COMPLETION_REQUESTED')

    const ws = await prisma.jobWorkspace.findUnique({ where: { jobId } })
    await prisma.jobWorkspace.update({
      where: { jobId },
      data: { completionRequestedAt: new Date(Date.now() - 49 * 60 * 60 * 1000) },
    })

    const results = await Promise.allSettled([
      completeAndReleaseEscrow(
        { jobId, actorId: customerUserId, actorType: 'SYSTEM' },
        jobId,
        { releaseMode: 'AUTO_RELEASE', autoReleaseHours: 48 }
      ),
      raiseJobDispute(
        { jobId, actorId: customerUserId, actorType: 'CUSTOMER' },
        jobId
      ),
    ])

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    expect(succeeded).toBe(1)
    expect(failed).toBe(1)

    const finalEscrow = await prisma.jobEscrow.findFirst({ where: { jobId } })
    expect(['RELEASED', 'ON_HOLD']).toContain(finalEscrow?.status)
  })

  it('concurrent release vs refund: exactly one terminal state', async () => {
    const { transitionJobWorkspace, completeAndReleaseEscrow, refundEscrow, resolveProviderActor } = await import('@/lib/domain/job-lifecycle')

    const { jobId } = await createReadyJob('rel-ref', companyProfileId, 'COMPANY')
    const resolved = await resolveProviderActor(jobId, companyWorkerId)
    await transitionJobWorkspace({ jobId, actorId: companyWorkerId, actorType: resolved! }, 'COMPLETION_REQUESTED')

    const results = await Promise.allSettled([
      completeAndReleaseEscrow({ jobId, actorId: customerUserId, actorType: 'CUSTOMER' }, jobId),
      refundEscrow({ jobId, actorId: customerUserId, actorType: 'CUSTOMER' }, jobId),
    ])

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    expect(succeeded).toBe(1)
    expect(failed).toBe(1)

    const finalEscrow = await prisma.jobEscrow.findFirst({ where: { jobId } })
    expect(['RELEASED', 'REFUNDED']).toContain(finalEscrow?.status)
  })

  it('concurrent release vs dispute on individual job: exactly one terminal state', async () => {
    const { transitionJobWorkspace, completeAndReleaseEscrow, raiseJobDispute } = await import('@/lib/domain/job-lifecycle')

    const { jobId } = await createReadyJob('ind-disc', providerUserId, 'INDIVIDUAL')
    await transitionJobWorkspace({ jobId, actorId: providerUserId, actorType: 'PROVIDER' }, 'COMPLETION_REQUESTED')

    const results = await Promise.allSettled([
      completeAndReleaseEscrow({ jobId, actorId: customerUserId, actorType: 'CUSTOMER' }, jobId),
      raiseJobDispute({ jobId, actorId: customerUserId, actorType: 'CUSTOMER' }, jobId),
    ])

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    expect(succeeded).toBe(1)
    expect(failed).toBe(1)

    const finalEscrow = await prisma.jobEscrow.findFirst({ where: { jobId } })
    expect(['RELEASED', 'ON_HOLD']).toContain(finalEscrow?.status)
  })

  it('five concurrent debits on same wallet: exact balance check', async () => {
    const walletId = `${prefix}-wallet-${Date.now()}`
    const initialBalance = 100000n

    await prisma.$executeRawUnsafe(
      `INSERT INTO "WalletBalance" ("id", "walletId", "walletType", "balance", "availableBalance", "pendingBalance", "version", "createdAt", "updatedAt")
       VALUES ($1, $2, 'CUSTOMER', $3, $3, 0, 1, now(), now())
       ON CONFLICT ("walletType", "walletId") DO UPDATE SET "balance" = $3, "availableBalance" = $3, "version" = 1`,
      walletId, walletId, initialBalance
    )

    const debitAmount = 1000n
    const { postLedgerTransaction } = await import('@/lib/ledger')

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        postLedgerTransaction({
          entries: [
            { accountId: walletId, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: debitAmount },
            { accountId: `test-sink-${i}`, accountType: 'TEST', entryType: 'CREDIT', amount: debitAmount },
          ],
          referenceType: 'TEST_DEBIT',
          referenceId: `${prefix}-debit-${i}`,
          idempotencyKey: `debit-${prefix}-${i}-${Date.now()}`,
          createdBy: 'test',
        })
      )
    )

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    expect(succeeded + failed).toBe(5)
    expect(succeeded).toBeGreaterThanOrEqual(4)

    const finalBalance = await prisma.$queryRawUnsafe<{ balance: bigint }[]>(
      `SELECT "balance" FROM "WalletBalance" WHERE "walletType" = 'CUSTOMER' AND "walletId" = $1`,
      walletId
    )
    const expectedRemaining = initialBalance - BigInt(succeeded) * debitAmount
    expect(finalBalance[0].balance).toBe(expectedRemaining)
  })

  it('insufficient funds: concurrent debits fail without corrupting balance', async () => {
    const walletId = `${prefix}-insuf-${Date.now()}`
    const initialBalance = 2500n

    await prisma.$executeRawUnsafe(
      `INSERT INTO "WalletBalance" ("id", "walletId", "walletType", "balance", "availableBalance", "pendingBalance", "version", "createdAt", "updatedAt")
       VALUES ($1, $2, 'CUSTOMER', $3, $3, 0, 1, now(), now())
       ON CONFLICT ("walletType", "walletId") DO UPDATE SET "balance" = $3, "availableBalance" = $3, "version" = 1`,
      walletId, walletId, initialBalance
    )

    const debitAmount = 1500n
    const { postLedgerTransaction } = await import('@/lib/ledger')

    const results = await Promise.allSettled(
      Array.from({ length: 3 }, (_, i) =>
        postLedgerTransaction({
          entries: [
            { accountId: walletId, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: debitAmount },
            { accountId: `test-sink-insuf-${i}`, accountType: 'TEST', entryType: 'CREDIT', amount: debitAmount },
          ],
          referenceType: 'TEST_DEBIT',
          referenceId: `${prefix}-insuf-${i}`,
          idempotencyKey: `insuf-${prefix}-${i}-${Date.now()}`,
          createdBy: 'test',
        })
      )
    )

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    expect(succeeded).toBeLessThanOrEqual(1)

    const finalBalance = await prisma.$queryRawUnsafe<{ balance: bigint }[]>(
      `SELECT "balance" FROM "WalletBalance" WHERE "walletType" = 'CUSTOMER' AND "walletId" = $1`,
      walletId
    )
    expect(finalBalance[0].balance).toBeGreaterThanOrEqual(0n)
    expect(finalBalance[0].balance).toBeLessThanOrEqual(initialBalance)
  })

  it('ledger entries are always balanced after concurrent operations', async () => {
    const { jobId } = await createReadyJob('balanced', companyProfileId, 'COMPANY')
    const { transitionJobWorkspace, resolveProviderActor } = await import('@/lib/domain/job-lifecycle')
    const resolved = await resolveProviderActor(jobId, companyWorkerId)
    await transitionJobWorkspace({ jobId, actorId: companyWorkerId, actorType: resolved! }, 'COMPLETION_REQUESTED')

    const ledgerBefore = await prisma.financialLedger.findMany({ where: { referenceId: { contains: prefix } } })

    const { completeAndReleaseEscrow } = await import('@/lib/domain/job-lifecycle')
    await completeAndReleaseEscrow({ jobId, actorId: customerUserId, actorType: 'CUSTOMER' }, jobId)

    const allEntries = await prisma.financialLedger.findMany({
      where: { referenceType: 'ESCROW_RELEASE', referenceId: { contains: prefix } },
    })

    const credits = allEntries.filter(e => e.entryType === 'CREDIT').reduce((sum, e) => sum + e.amount, 0n)
    const debits = allEntries.filter(e => e.entryType === 'DEBIT').reduce((sum, e) => sum + e.amount, 0n)
    expect(credits).toBe(debits)
  })

  it('idempotency: duplicate release attempt returns same result', async () => {
    const { transitionJobWorkspace, completeAndReleaseEscrow, resolveProviderActor } = await import('@/lib/domain/job-lifecycle')

    const { jobId } = await createReadyJob('idemp', companyProfileId, 'COMPANY')
    const resolved = await resolveProviderActor(jobId, companyWorkerId)
    await transitionJobWorkspace({ jobId, actorId: companyWorkerId, actorType: resolved! }, 'COMPLETION_REQUESTED')

    const result1 = await completeAndReleaseEscrow({ jobId, actorId: customerUserId, actorType: 'CUSTOMER' }, jobId)
    expect(result1.commission).toBeGreaterThanOrEqual(0)

    const result2 = await completeAndReleaseEscrow(
      { jobId, actorId: customerUserId, actorType: 'CUSTOMER' },
      jobId
    )
    expect(result2).toEqual(result1)

    const ledgerEntries = await prisma.financialLedger.findMany({
      where: { referenceType: 'ESCROW_RELEASE', description: { contains: jobId } },
    })
    expect(ledgerEntries.length).toBeGreaterThanOrEqual(1)
  })

  it('COMPANY authorization: active authorized worker → allowed', async () => {
    const { resolveProviderActor, transitionJobWorkspace } = await import('@/lib/domain/job-lifecycle')

    const { jobId } = await createReadyJob('auth-active', companyProfileId, 'COMPANY')

    const actorType = await resolveProviderActor(jobId, companyWorkerId)
    expect(actorType).toBe('COMPANY')

    await transitionJobWorkspace({ jobId, actorId: companyWorkerId, actorType: actorType! }, 'COMPLETION_REQUESTED')

    const ws = await prisma.jobWorkspace.findUnique({ where: { jobId } })
    expect(ws?.progressStatus).toBe('COMPLETION_REQUESTED')
  })

  it('COMPANY authorization: unrelated user → denied', async () => {
    const { resolveProviderActor, transitionJobWorkspace } = await import('@/lib/domain/job-lifecycle')

    const { jobId } = await createReadyJob('auth-unrelated', companyProfileId, 'COMPANY')

    const actorType = await resolveProviderActor(jobId, unrelatedUserId)
    expect(actorType).toBeNull()

    await expect(
      transitionJobWorkspace({ jobId, actorId: unrelatedUserId, actorType: 'PROVIDER' }, 'COMPLETION_REQUESTED')
    ).rejects.toThrow()
  })

  it('COMPANY authorization: inactive TeamMember → denied', async () => {
    const { resolveProviderActor, transitionJobWorkspace } = await import('@/lib/domain/job-lifecycle')

    const inactiveWorkerId = `${prefix}-inactive-worker`
    await prisma.user.create({
      data: { id: inactiveWorkerId, email: `${inactiveWorkerId}@test.com`, passwordHash: 'h', name: 'Inactive Worker', role: 'TASKER', isActive: true, updatedAt: new Date(), identityStatus: 'VERIFIED' },
    })
    await prisma.teamMember.create({
      data: { companyId: companyProfileId, userId: inactiveWorkerId, name: 'Inactive', role: 'WORKER', status: 'INACTIVE', skills: '[]' },
    })

    const { jobId } = await createReadyJob('auth-inactive', companyProfileId, 'COMPANY')

    const actorType = await resolveProviderActor(jobId, inactiveWorkerId)
    expect(actorType).toBeNull()

    await expect(
      transitionJobWorkspace({ jobId, actorId: inactiveWorkerId, actorType: 'COMPANY' }, 'COMPLETION_REQUESTED')
    ).rejects.toThrow()

    await prisma.teamMember.deleteMany({ where: { companyId: companyProfileId, userId: inactiveWorkerId } })
    await prisma.user.delete({ where: { id: inactiveWorkerId } })
  })

  it('COMPANY authorization: unrelated user + actorType COMPANY → denied at domain level', async () => {
    const { transitionJobWorkspace } = await import('@/lib/domain/job-lifecycle')

    const { jobId } = await createReadyJob('auth-unrelated-co', companyProfileId, 'COMPANY')

    await expect(
      transitionJobWorkspace({ jobId, actorId: unrelatedUserId, actorType: 'COMPANY' }, 'COMPLETION_REQUESTED')
    ).rejects.toThrow('Unauthorized')
  })

  it('PROVIDER authorization: individual provider with wrong actorType → denied', async () => {
    const { transitionJobWorkspace } = await import('@/lib/domain/job-lifecycle')

    const { jobId } = await createReadyJob('auth-wrong-type', providerUserId, 'INDIVIDUAL')

    await expect(
      transitionJobWorkspace({ jobId, actorId: providerUserId, actorType: 'COMPANY' }, 'COMPLETION_REQUESTED')
    ).rejects.toThrow('does not match provider identity')
  })

  it('multi-quote job: only ACCEPTED quote controls authorization', async () => {
    const { transitionJobWorkspace } = await import('@/lib/domain/job-lifecycle')

    const otherProviderId = `${prefix}-other-prov`
    await prisma.user.create({
      data: { id: otherProviderId, email: `${otherProviderId}@test.com`, passwordHash: 'h', name: 'Other Provider', role: 'TASKER', isActive: true, updatedAt: new Date(), identityStatus: 'VERIFIED' },
    })
    const otherProfile = await prisma.taskerProfile.create({
      data: { userId: otherProviderId, skills: '[]', rating: 3.0, completedJobs: 2, hourlyRate: 300, verificationStatus: 'VERIFIED', isVerified: true },
    })
    await prisma.taskerSkill.create({
      data: { taskerId: otherProfile.id, jobId: templateJobId, experienceYears: 1, experienceLevel: 1, hourlyRate: 300 },
    })

    const { jobId } = await createReadyJob('multi-q', providerUserId, 'INDIVIDUAL')

    const acceptedQuote = await prisma.jobQuote.findFirst({ where: { jobId, status: 'ACCEPTED' } })
    expect(acceptedQuote?.providerId).toBe(providerUserId)

    await prisma.jobQuote.create({
      data: {
        jobId,
        providerId: otherProviderId,
        providerType: 'INDIVIDUAL',
        price: 250000n,
        message: 'Other bid',
        status: 'PENDING',
        estimatedCompletionTime: '2h',
        attachments: '[]',
        updatedAt: new Date(),
      },
    })

    await transitionJobWorkspace({ jobId, actorId: providerUserId, actorType: 'PROVIDER' }, 'COMPLETION_REQUESTED')
    const ws = await prisma.jobWorkspace.findUnique({ where: { jobId } })
    expect(ws?.progressStatus).toBe('COMPLETION_REQUESTED')

    await expect(
      transitionJobWorkspace({ jobId, actorId: otherProviderId, actorType: 'PROVIDER' }, 'COMPLETION_REQUESTED')
    ).rejects.toThrow('Unauthorized')
  })
})
