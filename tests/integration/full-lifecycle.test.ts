import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const TEST_DB_URL = process.env.TEST_DB_URL
const isVPS = TEST_DB_URL && TEST_DB_URL.includes('maintainex_test')
const prisma = new PrismaClient()

describe.skipIf(!isVPS)('Phase 1-7 — Full Lifecycle Integration', () => {
  const prefix = `integ-${Date.now()}`
  const customerUserId = `${prefix}-cust`
  const individualProviderUserId = `${prefix}-ind-prov`
  const companyOwnerId = `${prefix}-co-owner`
  const companyUserId = `${prefix}-co-member`
  const companyProfileId = `${prefix}-company`
  let templateJobId: string
  let categoryId: string
  let serviceTemplateId: string

  const jobIds: string[] = []
  const userIds: string[] = [customerUserId, individualProviderUserId, companyOwnerId, companyUserId]

  afterAll(async () => {
    for (const jid of jobIds) {
      await prisma.commissionSettlement.deleteMany({ where: { jobId: jid } })
      await prisma.companyJobAssignment.deleteMany({ where: { jobId: jid } })
      await prisma.financialLedger.deleteMany({ where: { referenceId: jid } })
      await prisma.jobEscrow.deleteMany({ where: { jobId: jid } })
      await prisma.jobVerificationPin.deleteMany({ where: { jobId: jid } })
      await prisma.jobWorkspace.deleteMany({ where: { jobId: jid } })
      await prisma.jobQuote.deleteMany({ where: { jobId: jid } })
      await prisma.marketplaceJob.deleteMany({ where: { id: jid } })
    }
    await prisma.weeklySettlement.deleteMany({ where: { providerId: { in: [individualProviderUserId, companyOwnerId] } } }).catch(() => {})
    await prisma.taskerSkill.deleteMany({ where: { jobId: templateJobId } })
    await prisma.companySpecialty.deleteMany({ where: { companyId: companyProfileId } })
    await prisma.teamMember.deleteMany({ where: { companyId: companyProfileId } })
    await prisma.companyProfile.deleteMany({ where: { id: companyProfileId } })
    await prisma.serviceTemplate.deleteMany({ where: { id: serviceTemplateId } })
    await prisma.templateJob.deleteMany({ where: { id: templateJobId } })
    await prisma.jobCategory.deleteMany({ where: { id: categoryId } })
    await prisma.taskerProfile.deleteMany({ where: { userId: { in: [individualProviderUserId, companyUserId] } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    await prisma.$disconnect()
  })

  beforeAll(async () => {
    categoryId = `${prefix}-cat`
    templateJobId = `${prefix}-template`
    serviceTemplateId = `${prefix}-st`

    await prisma.jobCategory.create({
      data: { id: categoryId, name: `${prefix} Services`, slug: prefix, iconName: 'wrench', colorHex: '#FF0000', countries: 'LK', isActive: true },
    })

    await prisma.templateJob.create({
      data: { id: templateJobId, name: 'Integration Test Service', description: 'Full lifecycle test', categoryId, priceMin: 1000, priceMax: 5000, whatIsIncluded: 'Everything', typicalDurationMinutes: 60, countries: 'LK' },
    })

    await prisma.serviceTemplate.create({
      data: { id: serviceTemplateId, jobCategoryId: categoryId, templateJobId, name: 'Test Template', slug: `${prefix}-tpl`, description: 'Test', questionsJson: '[]', defaultDurationMinutes: 60, priceMin: 1000, priceMax: 5000, countryCode: 'LK' },
    })

    await prisma.user.createMany({
      data: [
        { id: customerUserId, email: `${customerUserId}@test.com`, passwordHash: 'h', name: 'Test Customer', role: 'CUSTOMER', isActive: true, updatedAt: new Date(), identityStatus: 'VERIFIED' },
        { id: individualProviderUserId, email: `${individualProviderUserId}@test.com`, passwordHash: 'h', name: 'Test Provider', role: 'TASKER', isActive: true, updatedAt: new Date(), identityStatus: 'VERIFIED' },
        { id: companyOwnerId, email: `${companyOwnerId}@test.com`, passwordHash: 'h', name: 'Company Owner', role: 'TASKER', isActive: true, updatedAt: new Date(), identityStatus: 'VERIFIED' },
        { id: companyUserId, email: `${companyUserId}@test.com`, passwordHash: 'h', name: 'Company Worker', role: 'TASKER', isActive: true, updatedAt: new Date(), identityStatus: 'VERIFIED' },
      ],
    })

    const indProfile = await prisma.taskerProfile.create({
      data: { userId: individualProviderUserId, skills: '[]', rating: 4.5, completedJobs: 10, hourlyRate: 500, verificationStatus: 'VERIFIED', isVerified: true },
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
        { companyId: companyProfileId, userId: companyUserId, name: 'Worker', role: 'WORKER', status: 'ACTIVE', skills: '[]' },
      ],
    })

    const custWallet = await prisma.customerWallet.create({ data: { userId: customerUserId, balance: 100000 } })
    await prisma.providerWallet.create({ data: { userId: individualProviderUserId, availableBalance: 0 } })
    await prisma.providerWallet.create({ data: { userId: companyOwnerId, availableBalance: 0 } })

    await prisma.$executeRawUnsafe(
      `INSERT INTO "WalletBalance" ("id", "walletId", "walletType", "balance", "availableBalance", "pendingBalance", "version", "createdAt", "updatedAt")
       VALUES ($1, $1, 'CUSTOMER', 10000000, 10000000, 0, 1, NOW(), NOW())
       ON CONFLICT ("walletType", "walletId") DO UPDATE SET "balance" = 10000000, "availableBalance" = 10000000`,
      custWallet.id
    )

    await prisma.companySpecialty.create({
      data: { companyId: companyProfileId, jobId: templateJobId },
    })

    const workerProfile = await prisma.taskerProfile.create({
      data: { userId: companyUserId, skills: '[]', rating: 4.0, completedJobs: 5, hourlyRate: 400, verificationStatus: 'VERIFIED', isVerified: true },
    })
    await prisma.taskerSkill.create({
      data: { taskerId: workerProfile.id, jobId: templateJobId, experienceYears: 1, experienceLevel: 1, hourlyRate: 400 },
    })
  })

  it('INDIVIDUAL provider: full lifecycle from creation to completion', async () => {
    const { createBookNowJob } = await import('@/lib/domain/book-now')

    const bookResult = await createBookNowJob({
      customerId: customerUserId,
      templateJobId,
      providerId: individualProviderUserId,
      providerType: 'INDIVIDUAL',
      scheduledDate: new Date(),
      timeSlot: 'morning',
      address: '123 Test St',
      district: 'Colombo',
    })

    expect(bookResult.job).toBeTruthy()
    expect(bookResult.quote).toBeTruthy()
    expect(bookResult.quote.providerType).toBe('INDIVIDUAL')
    jobIds.push(bookResult.job.id)

    const job = await prisma.marketplaceJob.findUnique({ where: { id: bookResult.job.id } })
    expect(job?.status).toBe('OPEN')

    const quote = await prisma.jobQuote.findFirst({ where: { jobId: bookResult.job.id } })
    expect(quote).toBeTruthy()
    expect(quote?.status).toBe('PENDING')
    expect(quote?.providerType).toBe('INDIVIDUAL')

    const { acceptJobQuote } = await import('@/lib/domain/job-lifecycle')
    await acceptJobQuote(
      { jobId: bookResult.job.id, actorId: customerUserId, actorType: 'CUSTOMER' },
      quote!.id
    )

    const ws = await prisma.jobWorkspace.findUnique({ where: { jobId: bookResult.job.id } })
    expect(ws?.progressStatus).toBe('ACCEPTED')

    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: bookResult.job.id } })
    expect(escrow).toBeTruthy()

    const { fundEscrow } = await import('@/lib/domain/job-lifecycle')
    await fundEscrow(
      { jobId: bookResult.job.id, actorId: customerUserId, actorType: 'CUSTOMER' },
      bookResult.job.id
    )

    const fundedEscrow = await prisma.jobEscrow.findFirst({ where: { jobId: bookResult.job.id } })
    expect(fundedEscrow?.status).toBe('PROTECTED')

    const fundedJob = await prisma.marketplaceJob.findUnique({ where: { id: bookResult.job.id } })
    expect(fundedJob?.status).toBe('QUOTE_ACCEPTED')

    const { generateJobPin, verifyJobPin } = await import('@/lib/domain/job-pin')
    const pinResult = await generateJobPin(bookResult.job.id, customerUserId)
    expect(pinResult.pin).toMatch(/^\d{6}$/)

    const wsAfterPin = await prisma.jobWorkspace.findUnique({ where: { jobId: bookResult.job.id } })
    expect(wsAfterPin?.progressStatus).toBe('ACCEPTED')

    const arrival = await verifyJobPin(bookResult.job.id, individualProviderUserId, pinResult.pin, 'ARRIVAL')
    expect(arrival.valid).toBe(true)
    const workStart = await verifyJobPin(bookResult.job.id, individualProviderUserId, pinResult.pin, 'WORK_START')
    expect(workStart.valid).toBe(true)

    const wsAfterStart = await prisma.jobWorkspace.findUnique({ where: { jobId: bookResult.job.id } })
    expect(wsAfterStart?.progressStatus).toBe('IN_PROGRESS')
    const jobAfterStart = await prisma.marketplaceJob.findUnique({ where: { id: bookResult.job.id } })
    expect(jobAfterStart?.status).toBe('IN_PROGRESS')

    const { transitionJobWorkspace } = await import('@/lib/domain/job-lifecycle')
    await transitionJobWorkspace(
      { jobId: bookResult.job.id, actorId: individualProviderUserId, actorType: 'PROVIDER' },
      'COMPLETION_REQUESTED'
    )

    const wsAfterComplete = await prisma.jobWorkspace.findUnique({ where: { jobId: bookResult.job.id } })
    expect(wsAfterComplete?.progressStatus).toBe('COMPLETION_REQUESTED')
    expect(wsAfterComplete?.completionRequestedAt).toBeTruthy()

    const { completeAndReleaseEscrow } = await import('@/lib/domain/job-lifecycle')
    const releaseResult = await completeAndReleaseEscrow(
      { jobId: bookResult.job.id, actorId: customerUserId, actorType: 'CUSTOMER' },
      bookResult.job.id
    )

    expect(releaseResult.commission).toBeGreaterThanOrEqual(0)
    expect(releaseResult.netAmount).toBeGreaterThan(0)

    const finalJob = await prisma.marketplaceJob.findUnique({ where: { id: bookResult.job.id } })
    expect(finalJob?.status).toBe('COMPLETED')

    const finalWs = await prisma.jobWorkspace.findUnique({ where: { jobId: bookResult.job.id } })
    expect(finalWs?.progressStatus).toBe('COMPLETED')

    const finalEscrow = await prisma.jobEscrow.findFirst({ where: { jobId: bookResult.job.id } })
    expect(finalEscrow?.status).toBe('RELEASED')

    const ledgerEntries = await prisma.financialLedger.findMany({
      where: { referenceId: finalEscrow!.id, referenceType: 'ESCROW_RELEASE' },
    })
    expect(ledgerEntries.length).toBeGreaterThanOrEqual(2)

    const commission = await prisma.commissionSettlement.findFirst({ where: { jobId: bookResult.job.id } })
    expect(commission).toBeTruthy()
  })

  it('COMPANY provider: full lifecycle from creation to completion', async () => {
    const { createBookNowJob } = await import('@/lib/domain/book-now')

    const bookResult = await createBookNowJob({
      customerId: customerUserId,
      templateJobId,
      providerId: companyProfileId,
      providerType: 'COMPANY',
      scheduledDate: new Date(),
      timeSlot: 'afternoon',
      address: '456 Corp Ave',
      district: 'Kandy',
    })

    expect(bookResult.job).toBeTruthy()
    expect(bookResult.quote.providerType).toBe('COMPANY')
    expect(bookResult.quote.providerId).toBe(companyProfileId)
    jobIds.push(bookResult.job.id)

    const quote = await prisma.jobQuote.findFirst({ where: { jobId: bookResult.job.id } })
    expect(quote?.providerType).toBe('COMPANY')

    const { acceptJobQuote, fundEscrow, transitionJobWorkspace, completeAndReleaseEscrow, resolveProviderActor } = await import('@/lib/domain/job-lifecycle')

    await acceptJobQuote(
      { jobId: bookResult.job.id, actorId: customerUserId, actorType: 'CUSTOMER' },
      quote!.id
    )

    const wsAccepted = await prisma.jobWorkspace.findUnique({ where: { jobId: bookResult.job.id } })
    expect(wsAccepted?.progressStatus).toBe('ACCEPTED')

    const { createAssignment, workerAcceptAssignment } = await import('@/lib/domain/company-job-assignment')
    const assignmentResult = await createAssignment({
      companyId: companyProfileId,
      jobId: bookResult.job.id,
      workerUserId: companyUserId,
      assignedByUserId: companyOwnerId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(assignmentResult.success).toBe(true)
    expect(assignmentResult.assignmentId).toBeTruthy()
    const acceptedAssignment = await workerAcceptAssignment(assignmentResult.assignmentId!, companyUserId)
    expect(acceptedAssignment.success).toBe(true)

    await fundEscrow(
      { jobId: bookResult.job.id, actorId: customerUserId, actorType: 'CUSTOMER' },
      bookResult.job.id
    )

    const fundedEscrow = await prisma.jobEscrow.findFirst({ where: { jobId: bookResult.job.id } })
    expect(fundedEscrow?.status).toBe('PROTECTED')
    expect(fundedEscrow?.providerId).toBe(companyProfileId)

    const fundedJob = await prisma.marketplaceJob.findUnique({ where: { id: bookResult.job.id } })
    expect(fundedJob?.status).toBe('QUOTE_ACCEPTED')

    const { generateJobPin, verifyJobPin } = await import('@/lib/domain/job-pin')
    const pinResult = await generateJobPin(bookResult.job.id, customerUserId)
    expect(pinResult.pin).toMatch(/^\d{6}$/)

    const arrival = await verifyJobPin(bookResult.job.id, companyUserId, pinResult.pin, 'ARRIVAL')
    expect(arrival.valid).toBe(true)
    const workStart = await verifyJobPin(bookResult.job.id, companyUserId, pinResult.pin, 'WORK_START')
    expect(workStart.valid).toBe(true)

    const wsAfterPin = await prisma.jobWorkspace.findUnique({ where: { jobId: bookResult.job.id } })
    expect(wsAfterPin?.progressStatus).toBe('IN_PROGRESS')
    const jobAfterPin = await prisma.marketplaceJob.findUnique({ where: { id: bookResult.job.id } })
    expect(jobAfterPin?.status).toBe('IN_PROGRESS')
    const assignmentAfterPin = await prisma.companyJobAssignment.findUnique({
      where: { id: assignmentResult.assignmentId! },
    })
    expect(assignmentAfterPin?.status).toBe('IN_PROGRESS')
    expect(assignmentAfterPin?.startedAt).toBeTruthy()

    const resolvedActorType = await resolveProviderActor(bookResult.job.id, companyUserId)
    expect(resolvedActorType).toBe('COMPANY')

    await transitionJobWorkspace(
      { jobId: bookResult.job.id, actorId: companyUserId, actorType: resolvedActorType! },
      'COMPLETION_REQUESTED'
    )

    const wsAfterComplete = await prisma.jobWorkspace.findUnique({ where: { jobId: bookResult.job.id } })
    expect(wsAfterComplete?.progressStatus).toBe('COMPLETION_REQUESTED')

    const releaseResult = await completeAndReleaseEscrow(
      { jobId: bookResult.job.id, actorId: customerUserId, actorType: 'CUSTOMER' },
      bookResult.job.id
    )

    expect(releaseResult.commission).toBeGreaterThanOrEqual(0)
    expect(releaseResult.netAmount).toBeGreaterThan(0)
    expect(releaseResult.providerType).toBe('COMPANY')

    const finalJob = await prisma.marketplaceJob.findUnique({ where: { id: bookResult.job.id } })
    expect(finalJob?.status).toBe('COMPLETED')

    const finalEscrow = await prisma.jobEscrow.findFirst({ where: { jobId: bookResult.job.id } })
    expect(finalEscrow?.status).toBe('RELEASED')

    const ledgerEntries = await prisma.financialLedger.findMany({
      where: { referenceId: finalEscrow!.id, referenceType: 'ESCROW_RELEASE' },
    })
    expect(ledgerEntries.length).toBeGreaterThanOrEqual(2)

    const commission = await prisma.commissionSettlement.findFirst({ where: { jobId: bookResult.job.id } })
    expect(commission).toBeTruthy()
    expect(commission?.providerId).toBe(companyOwnerId)
  })

  it('dispute path: hold escrow for dispute', async () => {
    const { createBookNowJob } = await import('@/lib/domain/book-now')
    const { acceptJobQuote, fundEscrow, holdEscrowForDispute } = await import('@/lib/domain/job-lifecycle')

    const bookResult = await createBookNowJob({
      customerId: customerUserId,
      templateJobId,
      providerId: individualProviderUserId,
      providerType: 'INDIVIDUAL',
      scheduledDate: new Date(),
      timeSlot: 'evening',
      address: '789 Dispute Ln',
      district: 'Galle',
    })
    jobIds.push(bookResult.job.id)

    const quote = await prisma.jobQuote.findFirst({ where: { jobId: bookResult.job.id } })
    await acceptJobQuote({ jobId: bookResult.job.id, actorId: customerUserId, actorType: 'CUSTOMER' }, quote!.id)
    await fundEscrow({ jobId: bookResult.job.id, actorId: customerUserId, actorType: 'CUSTOMER' }, bookResult.job.id)

    const holdResult = await holdEscrowForDispute(
      { jobId: bookResult.job.id, actorId: customerUserId, actorType: 'CUSTOMER' },
      bookResult.job.id
    )
    expect(holdResult.escrowId).toBeTruthy()

    const escrow = await prisma.jobEscrow.findUnique({ where: { id: holdResult.escrowId } })
    expect(escrow?.status).toBe('ON_HOLD')
  })
})
