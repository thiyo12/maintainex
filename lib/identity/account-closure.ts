import { prisma, type PrismaClientOrTx } from '@/lib/prisma'

const ACTIVE_JOB_STATUSES = ['OPEN', 'QUOTE_ACCEPTED', 'IN_PROGRESS']
const ACTIVE_ASSIGNMENT_STATUSES = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS']
const OPEN_DISPUTE_STATUSES = ['OPEN', 'UNDER_REVIEW', 'RESOLVING']
const PENDING_PAYOUT_STATUSES = ['PENDING', 'REQUESTED', 'RESERVED', 'PROCESSING']
const PENDING_PAYOUT_REQUEST_STATUSES = ['pending', 'processing']
const UNRESOLVED_PAYMENT_STATUSES = ['CREATED', 'PENDING', 'REFUND_REQUIRED', 'REFUND_PROCESSING']
const UNRESOLVED_ESCROW_STATUSES = ['PENDING', 'PENDING_PAYMENT', 'PROTECTED', 'ON_HOLD', 'CASH_CONFIRMED']

export type AccountClosureBlockerCode =
  | 'ACTIVE_JOBS'
  | 'OPEN_DISPUTES'
  | 'PENDING_PAYOUTS'
  | 'UNRESOLVED_PAYMENTS'
  | 'UNRESOLVED_ESCROW'
  | 'COMPANY_OWNERSHIP_TRANSFER_REQUIRED'

export type AccountClosureBlocker = {
  code: AccountClosureBlockerCode
  label: string
  count: number
}

export type AccountClosurePreflight = {
  canClose: boolean
  alreadyClosed: boolean
  blockers: AccountClosureBlocker[]
  outstandingCommission: Array<{
    providerIdentityId: string
    identityType: string
    currency: string
    amountMinor: string
  }>
  closesWithBalance: boolean
}

async function resolveProviderIds(tx: PrismaClientOrTx, userId: string) {
  const [tasker, company] = await Promise.all([
    tx.taskerProfile.findUnique({
      where: { userId },
      select: { id: true, userId: true },
    }),
    tx.companyProfile.findUnique({
      where: { userId },
      select: { id: true, userId: true },
    }),
  ])

  const providerIds = [userId]
  if (tasker?.id) providerIds.push(tasker.id)
  if (company?.id) providerIds.push(company.id)

  return {
    tasker,
    company,
    providerIds: [...new Set(providerIds)],
  }
}

export async function getAccountClosurePreflight(
  tx: PrismaClientOrTx,
  userId: string,
): Promise<AccountClosurePreflight> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true },
  })
  if (!user) throw new Error('USER_NOT_FOUND')

  const provider = await resolveProviderIds(tx, userId)
  const acceptedProviderQuotes = await tx.jobQuote.findMany({
    where: {
      providerId: { in: provider.providerIds },
      status: 'ACCEPTED',
    },
    select: { jobId: true },
  })
  const providerJobIds = [...new Set(acceptedProviderQuotes.map(item => item.jobId))]

  const [
    activeCustomerJobs,
    activeProviderJobs,
    activeWorkerAssignments,
    openDisputes,
    pendingPayouts,
    pendingPayoutRequests,
    unresolvedCustomerPayments,
    unresolvedEscrows,
    otherActiveCompanyMembers,
    identities,
  ] = await Promise.all([
    tx.marketplaceJob.count({
      where: {
        customerId: userId,
        status: { in: ACTIVE_JOB_STATUSES },
      },
    }),
    providerJobIds.length
      ? tx.marketplaceJob.count({
          where: {
            id: { in: providerJobIds },
            status: { in: ACTIVE_JOB_STATUSES },
          },
        })
      : Promise.resolve(0),
    tx.companyJobAssignment.count({
      where: {
        workerUserId: userId,
        status: { in: ACTIVE_ASSIGNMENT_STATUSES },
      },
    }),
    tx.marketplaceDispute.count({
      where: {
        status: { in: OPEN_DISPUTE_STATUSES },
        OR: [
          { raisedById: userId },
          { job: { customerId: userId } },
          ...(providerJobIds.length ? [{ jobId: { in: providerJobIds } }] : []),
        ],
      },
    }),
    tx.payout.count({
      where: {
        userId,
        status: { in: PENDING_PAYOUT_STATUSES },
      },
    }),
    tx.payoutRequest.count({
      where: {
        userId,
        status: { in: PENDING_PAYOUT_REQUEST_STATUSES },
      },
    }),
    tx.paymentIntent.count({
      where: {
        customerId: userId,
        status: { in: UNRESOLVED_PAYMENT_STATUSES },
      },
    }),
    tx.jobEscrow.count({
      where: {
        OR: [
          { customerId: userId },
          { providerId: { in: provider.providerIds } },
        ],
        status: { in: UNRESOLVED_ESCROW_STATUSES },
      },
    }),
    provider.company
      ? tx.teamMember.count({
          where: {
            companyId: provider.company.id,
            status: 'ACTIVE',
            userId: { not: userId },
          },
        })
      : Promise.resolve(0),
    tx.providerIdentity.findMany({
      where: {
        OR: [
          { currentUserId: userId },
          ...(provider.tasker?.id
            ? [{ identityType: 'TASKER', subjectId: provider.tasker.id }]
            : []),
          ...(provider.company?.id
            ? [{ identityType: 'COMPANY', subjectId: provider.company.id }]
            : []),
        ],
      },
      select: {
        id: true,
        identityType: true,
        financialAccounts: {
          where: { commissionDue: { gt: 0 } },
          select: {
            currency: true,
            commissionDue: true,
          },
        },
      },
    }),
  ])

  const activeJobs = activeCustomerJobs + activeProviderJobs + activeWorkerAssignments

  const blockers: AccountClosureBlocker[] = [
    { code: 'ACTIVE_JOBS', label: 'Active customer/provider jobs or assignments', count: activeJobs },
    { code: 'OPEN_DISPUTES', label: 'Open disputes', count: openDisputes },
    { code: 'PENDING_PAYOUTS', label: 'Pending payouts', count: pendingPayouts + pendingPayoutRequests },
    { code: 'UNRESOLVED_PAYMENTS', label: 'Payments/refunds still processing', count: unresolvedCustomerPayments },
    { code: 'UNRESOLVED_ESCROW', label: 'Escrow/cash jobs still unsettled', count: unresolvedEscrows },
    {
      code: 'COMPANY_OWNERSHIP_TRANSFER_REQUIRED',
      label: 'Active company members require ownership/closure handling',
      count: otherActiveCompanyMembers,
    },
  ].filter(item => item.count > 0) as AccountClosureBlocker[]

  const outstandingCommission = identities.flatMap(identity =>
    identity.financialAccounts.map(account => ({
      providerIdentityId: identity.id,
      identityType: identity.identityType,
      currency: account.currency,
      amountMinor: account.commissionDue.toString(),
    }))
  )

  return {
    canClose: blockers.length === 0,
    alreadyClosed: !user.isActive,
    blockers,
    outstandingCommission,
    closesWithBalance: outstandingCommission.length > 0,
  }
}

/**
 * Compatibility assessment retained for existing domain callers/tests.
 * The richer app preflight is available through getAccountClosurePreflight.
 */
export async function evaluateAccountClosure(
  tx: PrismaClientOrTx,
  userId: string,
) {
  const preflight = await getAccountClosurePreflight(tx, userId)
  return {
    ...preflight,
    blockers: preflight.blockers.map(item => item.code),
    blockerDetails: preflight.blockers,
    outstandingBalances: preflight.outstandingCommission.map(item => ({
      providerIdentityId: item.providerIdentityId,
      identityType: item.identityType,
      currency: item.currency,
      commissionDueMinor: BigInt(item.amountMinor),
    })),
  }
}

async function closeAccountWithTx(
  tx: PrismaClientOrTx,
  input: {
    userId: string
    ipAddress?: string | null
    userAgent?: string | null
  },
) {
  const user = await tx.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
      isActive: true,
    },
  })
  if (!user) throw new Error('USER_NOT_FOUND')

  const preflight = await getAccountClosurePreflight(tx, input.userId)
  if (!user.isActive) {
    return {
      alreadyClosed: true,
      closedAt: null,
      preflight,
      closesWithBalance: preflight.closesWithBalance,
      outstandingBalances: preflight.outstandingCommission,
    }
  }

  if (!preflight.canClose) {
    const error = new Error('ACCOUNT_CLOSURE_BLOCKED') as Error & {
      preflight?: AccountClosurePreflight
      assessment?: {
        blockers: AccountClosureBlockerCode[]
        blockerDetails: AccountClosureBlocker[]
      }
    }
    error.preflight = preflight
    error.assessment = {
      blockers: preflight.blockers.map(item => item.code),
      blockerDetails: preflight.blockers,
    }
    throw error
  }

  const now = new Date()
  const claimed = await tx.user.updateMany({
    where: {
      id: input.userId,
      isActive: true,
    },
    data: {
      isActive: false,
      pushToken: null,
    },
  })
  if (claimed.count !== 1) {
    throw new Error('ACCOUNT_CLOSURE_CHANGED_CONCURRENTLY')
  }

  const identities = await tx.providerIdentity.findMany({
    where: { currentUserId: input.userId },
    select: {
      id: true,
      identityType: true,
      financialAccounts: {
        select: {
          commissionDue: true,
          currency: true,
        },
      },
    },
  })

  for (const identity of identities) {
    const hasDebt = identity.financialAccounts.some(account => account.commissionDue > 0n)
    await tx.providerIdentity.update({
      where: { id: identity.id },
      data: {
        standingStatus: hasDebt ? 'CLOSED_WITH_BALANCE' : 'CLOSED',
        closedAt: now,
      },
    })

    await tx.providerIntegritySignal.create({
      data: {
        providerIdentityId: identity.id,
        userId: input.userId,
        signalType: hasDebt ? 'ACCOUNT_CLOSED_WITH_BALANCE' : 'ACCOUNT_CLOSED',
        severity: hasDebt ? 'HIGH' : 'LOW',
        source: 'ACCOUNT_CLOSURE',
        status: hasDebt ? 'OPEN' : 'CONFIRMED',
        metadata: JSON.stringify({
          identityType: identity.identityType,
          closedAt: now.toISOString(),
          commissionBalances: identity.financialAccounts
            .filter(account => account.commissionDue > 0n)
            .map(account => ({
              currency: account.currency,
              amountMinor: account.commissionDue.toString(),
            })),
        }),
      },
    })
  }

  await tx.userSession.updateMany({
    where: {
      userId: input.userId,
      isValid: true,
    },
    data: {
      isValid: false,
      revokedAt: now,
      revokeReason: 'ACCOUNT_CLOSED',
    },
  })

  await tx.oTP.updateMany({
    where: {
      userId: input.userId,
      isUsed: false,
    },
    data: { isUsed: true },
  })

  await tx.taskerProfile.updateMany({
    where: { userId: input.userId },
    data: { isOnline: false },
  })

  await tx.teamMember.updateMany({
    where: {
      userId: input.userId,
      status: 'ACTIVE',
    },
    data: {
      isOnline: false,
      status: 'SUSPENDED',
    },
  })

  await tx.companyProfile.updateMany({
    where: { userId: input.userId },
    data: {
      subscriptionStatus: 'CANCELLED',
    },
  })

  await tx.securityAudit.create({
    data: {
      action: 'UPDATE',
      category: 'AUTH',
      userId: input.userId,
      userEmail: user.email,
      userRole: user.role,
      entityType: 'User',
      entityId: input.userId,
      entityName: user.name,
      description: preflight.closesWithBalance
        ? 'Marketplace account closed; durable provider identity retained with outstanding commission'
        : 'Marketplace account closed; durable provider identity and audit history retained',
      newValue: JSON.stringify({
        isActive: false,
        closesWithBalance: preflight.closesWithBalance,
        outstandingCommission: preflight.outstandingCommission,
      }),
      ipAddress: input.ipAddress || undefined,
      userAgent: input.userAgent || undefined,
      riskLevel: preflight.closesWithBalance ? 'HIGH' : 'MEDIUM',
      isSuspicious: false,
    },
  })

  return {
    alreadyClosed: false,
    closedAt: now,
    preflight,
    closesWithBalance: preflight.closesWithBalance,
    outstandingBalances: preflight.outstandingCommission,
  }
}

export async function closeAccountPreservingProviderIntegrity(
  tx: PrismaClientOrTx,
  userId: string,
) {
  return closeAccountWithTx(tx, { userId })
}

export async function closeMarketplaceAccount(input: {
  userId: string
  ipAddress?: string | null
  userAgent?: string | null
}) {
  return prisma.$transaction(tx => closeAccountWithTx(tx, input))
}
