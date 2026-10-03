import type { Prisma } from '@prisma/client'

const ACTIVE_JOB_STATUSES = ['OPEN', 'QUOTE_ACCEPTED', 'IN_PROGRESS'] as const
const ACTIVE_ASSIGNMENT_STATUSES = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] as const
const OPEN_DISPUTE_STATUSES = ['OPEN', 'UNDER_REVIEW', 'RESOLVING'] as const
const PENDING_PAYOUT_STATUSES = ['PENDING', 'REQUESTED', 'RESERVED', 'PROCESSING'] as const

export type AccountClosureBlocker =
  | 'ACTIVE_JOBS'
  | 'OPEN_DISPUTES'
  | 'PENDING_PAYOUTS'

export async function evaluateAccountClosure(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      isActive: true,
      taskerProfile: { select: { id: true } },
      companyProfile: { select: { id: true } },
    },
  })
  if (!user) throw new Error('USER_NOT_FOUND')

  const providerIdentities = await tx.providerIdentity.findMany({
    where: { currentUserId: userId },
    select: {
      id: true,
      identityType: true,
      subjectId: true,
      standingStatus: true,
      financialAccounts: {
        select: {
          currency: true,
          commissionDue: true,
          status: true,
        },
      },
    },
  })

  const providerClauses: Array<Record<string, unknown>> = []
  if (user.taskerProfile) {
    providerClauses.push({
      providerType: 'INDIVIDUAL',
      providerId: userId,
      status: 'ACCEPTED',
    })
  }
  if (user.companyProfile) {
    providerClauses.push({
      providerType: 'COMPANY',
      providerId: user.companyProfile.id,
      status: 'ACCEPTED',
    })
  }

  const [customerJobs, providerQuotes, workerAssignments, pendingPayouts] = await Promise.all([
    tx.marketplaceJob.findMany({
      where: {
        customerId: userId,
        status: { in: [...ACTIVE_JOB_STATUSES] },
      },
      select: { id: true },
    }),
    providerClauses.length > 0
      ? tx.jobQuote.findMany({
          where: { OR: providerClauses as any },
          select: {
            jobId: true,
            job: { select: { status: true } },
          },
        })
      : Promise.resolve([]),
    tx.companyJobAssignment.findMany({
      where: {
        workerUserId: userId,
        status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] },
      },
      select: { jobId: true },
    }),
    tx.payout.findMany({
      where: {
        userId,
        status: { in: [...PENDING_PAYOUT_STATUSES] },
      },
      select: { id: true, status: true, amount: true, currency: true },
    }),
  ])

  const activeProviderJobIds = providerQuotes
    .filter(quote => ACTIVE_JOB_STATUSES.includes(quote.job.status as any))
    .map(quote => quote.jobId)

  const activeJobIds = [...new Set([
    ...customerJobs.map(job => job.id),
    ...activeProviderJobIds,
    ...workerAssignments.map(assignment => assignment.jobId),
  ])]

  const openDisputes = activeJobIds.length > 0
    ? await tx.marketplaceDispute.findMany({
        where: {
          jobId: { in: activeJobIds },
          status: { in: [...OPEN_DISPUTE_STATUSES] },
        },
        select: { id: true, jobId: true, status: true },
      })
    : []

  const blockers: AccountClosureBlocker[] = []
  if (activeJobIds.length > 0) blockers.push('ACTIVE_JOBS')
  if (openDisputes.length > 0) blockers.push('OPEN_DISPUTES')
  if (pendingPayouts.length > 0) blockers.push('PENDING_PAYOUTS')

  const outstandingBalances = providerIdentities.flatMap(identity =>
    identity.financialAccounts
      .filter(account => account.commissionDue > 0n)
      .map(account => ({
        providerIdentityId: identity.id,
        identityType: identity.identityType,
        currency: account.currency,
        commissionDueMinor: account.commissionDue,
        status: account.status,
      }))
  )

  return {
    user,
    providerIdentities,
    blockers,
    activeJobIds,
    openDisputes,
    pendingPayouts,
    outstandingBalances,
    canClose: blockers.length === 0,
    closesWithBalance: outstandingBalances.length > 0,
  }
}

export async function closeAccountPreservingProviderIntegrity(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const assessment = await evaluateAccountClosure(tx, userId)
  if (!assessment.canClose) {
    const error = new Error('ACCOUNT_CLOSURE_BLOCKED')
    ;(error as Error & { assessment?: typeof assessment }).assessment = assessment
    throw error
  }

  const now = new Date()
  for (const identity of assessment.providerIdentities) {
    const hasDebt = identity.financialAccounts.some(account => account.commissionDue > 0n)
    await tx.providerIdentity.update({
      where: { id: identity.id },
      data: {
        standingStatus: hasDebt ? 'CLOSED_WITH_BALANCE' : 'CLOSED',
        closedAt: now,
      },
    })
  }

  await tx.taskerProfile.updateMany({
    where: { userId },
    data: { isOnline: false },
  })

  await tx.teamMember.updateMany({
    where: { userId, status: 'ACTIVE' },
    data: {
      status: 'SUSPENDED',
      isOnline: false,
    },
  })

  await tx.userSession.updateMany({
    where: {
      userId,
      isValid: true,
    },
    data: {
      isValid: false,
      revokedAt: now,
      revokeReason: 'ACCOUNT_CLOSED',
    },
  })

  await tx.user.update({
    where: { id: userId },
    data: { isActive: false },
  })

  return {
    closedAt: now,
    closesWithBalance: assessment.closesWithBalance,
    outstandingBalances: assessment.outstandingBalances,
  }
}
