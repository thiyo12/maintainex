import type { Prisma } from '@prisma/client'
import { postLedgerTransaction } from '@/lib/finance/ledger/ledger-service'
import type { Currency } from '@/lib/shared/money/money'
import {
  calculateOnlineDebtOffset,
  evaluateProviderFinancialStanding,
  type ProviderFinancialDecision,
  type ProviderFinancialPolicy,
} from '@/lib/finance/commissions/provider-financial-policy'

export type FinancialProviderType = 'INDIVIDUAL' | 'COMPANY'

export const DEFAULT_LK_LKR_POLICY: ProviderFinancialPolicy = {
  warningThresholdMinor: 200_000n,
  cashRestrictionThresholdMinor: 500_000n,
  reviewThresholdMinor: 1_000_000n,
  maxDebtAgeDays: 14,
  allowOnlineWhenCashRestricted: true,
  autoOffsetOnlineEarnings: true,
}

export const DEFAULT_CA_CAD_POLICY: ProviderFinancialPolicy = {
  warningThresholdMinor: 5_000n,
  cashRestrictionThresholdMinor: 10_000n,
  reviewThresholdMinor: 25_000n,
  maxDebtAgeDays: 14,
  allowOnlineWhenCashRestricted: true,
  autoOffsetOnlineEarnings: true,
}

function policyProviderType(providerType: FinancialProviderType): 'TASKER' | 'COMPANY' {
  return providerType === 'COMPANY' ? 'COMPANY' : 'TASKER'
}

function identityStanding(decision: ProviderFinancialDecision): string {
  if (decision.standing === 'CLEAR') return 'ACTIVE'
  return decision.standing
}

function earliestLiabilityDate(
  commissionDueAt?: Date | null,
  adjustmentDueAt?: Date | null,
): Date | null {
  if (!commissionDueAt) return adjustmentDueAt || null
  if (!adjustmentDueAt) return commissionDueAt
  return commissionDueAt <= adjustmentDueAt ? commissionDueAt : adjustmentDueAt
}

function evaluateAccountFinancialStanding(
  account: {
    commissionDue: bigint
    adjustmentDue: bigint
    oldestCommissionDueAt?: Date | null
    oldestAdjustmentDueAt?: Date | null
  },
  policy: ProviderFinancialPolicy,
): ProviderFinancialDecision {
  const decision = evaluateProviderFinancialStanding(
    {
      commissionDueMinor: account.commissionDue + account.adjustmentDue,
      oldestCommissionDueAt: earliestLiabilityDate(
        account.oldestCommissionDueAt,
        account.oldestAdjustmentDueAt,
      ),
    },
    policy,
  )

  // A post-payout chargeback/dispute loss is not ordinary commission debt.
  // Keep it under governed financial review until fully recovered or resolved.
  if (account.adjustmentDue > 0n) {
    return {
      ...decision,
      standing: 'REVIEW_REQUIRED',
      cashJobsAllowed: false,
      onlineJobsAllowed: policy.allowOnlineWhenCashRestricted,
      manualReviewRequired: true,
      reason: 'Outstanding post-payout provider balance adjustment requires review',
    }
  }

  return decision
}

export async function ensureProviderIdentity(
  tx: Prisma.TransactionClient,
  input: {
    providerId: string
    providerType: FinancialProviderType
    countryCode: string
  },
) {
  const countryCode = input.countryCode.trim().toUpperCase() || 'LK'

  if (input.providerType === 'COMPANY') {
    const company = await tx.companyProfile.findUnique({
      where: { id: input.providerId },
      select: {
        id: true,
        userId: true,
        companyName: true,
        logo: true,
        countryCode: true,
        isVerified: true,
        verificationStatus: true,
        verifiedAt: true,
      },
    })
    if (!company) throw new Error('COMPANY_PROVIDER_NOT_FOUND')

    return tx.providerIdentity.upsert({
      where: {
        identityType_subjectId: {
          identityType: 'COMPANY',
          subjectId: company.id,
        },
      },
      create: {
        identityType: 'COMPANY',
        subjectId: company.id,
        currentUserId: company.userId,
        countryCode: company.countryCode || countryCode,
        kycStatus:
          company.isVerified && company.verificationStatus === 'VERIFIED'
            ? 'VERIFIED'
            : 'PENDING',
        standingStatus: 'ACTIVE',
        verifiedDisplayName: company.companyName,
        verifiedPhotoUrl: company.logo,
        photoLocked: true,
        verifiedAt: company.verifiedAt,
      },
      update: {
        currentUserId: company.userId,
        countryCode: company.countryCode || countryCode,
        kycStatus:
          company.isVerified && company.verificationStatus === 'VERIFIED'
            ? 'VERIFIED'
            : 'PENDING',
        verifiedDisplayName: company.companyName,
        ...(company.logo ? { verifiedPhotoUrl: company.logo } : {}),
        photoLocked: true,
        verifiedAt: company.verifiedAt,
      },
    })
  }

  const tasker = await tx.taskerProfile.findUnique({
    where: { userId: input.providerId },
    select: {
      id: true,
      userId: true,
      profileImage: true,
      countryCode: true,
      isVerified: true,
      verificationStatus: true,
      verifiedAt: true,
      user: {
        select: {
          name: true,
          identityStatus: true,
        },
      },
    },
  })
  if (!tasker) throw new Error('TASKER_PROVIDER_NOT_FOUND')

  return tx.providerIdentity.upsert({
    where: {
      identityType_subjectId: {
        identityType: 'TASKER',
        subjectId: tasker.id,
      },
    },
    create: {
      identityType: 'TASKER',
      subjectId: tasker.id,
      currentUserId: tasker.userId,
      countryCode: tasker.countryCode || countryCode,
      kycStatus:
        tasker.isVerified &&
        tasker.verificationStatus === 'VERIFIED' &&
        tasker.user.identityStatus === 'VERIFIED'
          ? 'VERIFIED'
          : 'PENDING',
      standingStatus: 'ACTIVE',
      verifiedDisplayName: tasker.user.name,
      verifiedPhotoUrl: null,
      photoLocked: true,
      verifiedAt: tasker.verifiedAt,
    },
    update: {
      currentUserId: tasker.userId,
      countryCode: tasker.countryCode || countryCode,
      kycStatus:
        tasker.isVerified &&
        tasker.verificationStatus === 'VERIFIED' &&
        tasker.user.identityStatus === 'VERIFIED'
          ? 'VERIFIED'
          : 'PENDING',
      verifiedDisplayName: tasker.user.name,
      photoLocked: true,
      verifiedAt: tasker.verifiedAt,
    },
  })
}

export async function resolveProviderFinancialPolicy(
  tx: Prisma.TransactionClient,
  input: {
    countryCode: string
    providerType: FinancialProviderType
    currency: string
  },
): Promise<ProviderFinancialPolicy> {
  const countryCode = input.countryCode.trim().toUpperCase()
  const currency = input.currency.trim().toUpperCase()
  const providerType = policyProviderType(input.providerType)

  const configured = await tx.providerFinancialPolicyConfig.findUnique({
    where: {
      countryCode_providerType_currency: {
        countryCode,
        providerType,
        currency,
      },
    },
  })

  if (configured?.enabled) {
    return {
      warningThresholdMinor: configured.warningThresholdMinor,
      cashRestrictionThresholdMinor: configured.cashRestrictionThresholdMinor,
      reviewThresholdMinor: configured.reviewThresholdMinor,
      maxDebtAgeDays: configured.maxDebtAgeDays,
      allowOnlineWhenCashRestricted: configured.allowOnlineWhenCashRestricted,
      autoOffsetOnlineEarnings: configured.autoOffsetOnlineEarnings,
    }
  }

  // Safe launch fallback for the current Sri Lanka cash model. CRM policy rows
  // can override these values without code changes.
  if (countryCode === 'LK' && currency === 'LKR') {
    return DEFAULT_LK_LKR_POLICY
  }
  if (countryCode === 'CA' && currency === 'CAD') {
    return DEFAULT_CA_CAD_POLICY
  }

  throw new Error('PROVIDER_FINANCIAL_POLICY_NOT_CONFIGURED')
}

async function ensureFinancialAccount(
  tx: Prisma.TransactionClient,
  providerIdentityId: string,
  currency: string,
) {
  return tx.providerFinancialAccount.upsert({
    where: {
      providerIdentityId_currency: {
        providerIdentityId,
        currency,
      },
    },
    create: {
      providerIdentityId,
      currency,
    },
    update: {},
  })
}

export async function evaluateStoredProviderFinancialStanding(
  tx: Prisma.TransactionClient,
  input: {
    providerIdentityId: string
    providerType: FinancialProviderType
    countryCode: string
    currency: string
  },
) {
  const currency = input.currency.trim().toUpperCase()
  const account = await ensureFinancialAccount(tx, input.providerIdentityId, currency)
  const policy = await resolveProviderFinancialPolicy(tx, input)
  const decision = evaluateAccountFinancialStanding(account, policy)

  const updated = await tx.providerFinancialAccount.update({
    where: { id: account.id },
    data: {
      status: decision.standing,
      cashJobsAllowed: decision.cashJobsAllowed,
      onlineJobsAllowed: decision.onlineJobsAllowed,
      manualReviewRequired: decision.manualReviewRequired,
      lastEvaluatedAt: new Date(),
      version: { increment: 1 },
    },
  })

  await tx.providerIdentity.update({
    where: { id: input.providerIdentityId },
    data: { standingStatus: identityStanding(decision) },
  })

  return { account: updated, policy, decision }
}

export async function assertProviderCashEligible(
  tx: Prisma.TransactionClient,
  input: {
    providerId: string
    providerType: FinancialProviderType
    countryCode: string
    currency: string
  },
) {
  const identity = await ensureProviderIdentity(tx, input)
  const standing = await evaluateStoredProviderFinancialStanding(tx, {
    providerIdentityId: identity.id,
    providerType: input.providerType,
    countryCode: input.countryCode,
    currency: input.currency,
  })

  if (!standing.decision.cashJobsAllowed) {
    const error = new Error('PROVIDER_CASH_RESTRICTED')
    ;(error as Error & { code?: string }).code = 'PROVIDER_CASH_RESTRICTED'
    throw error
  }

  return {
    providerIdentity: identity,
    ...standing,
  }
}

export async function assertProviderOnlineEligible(
  tx: Prisma.TransactionClient,
  input: {
    providerId: string
    providerType: FinancialProviderType
    countryCode: string
    currency: string
  },
) {
  const identity = await ensureProviderIdentity(tx, input)
  const standing = await evaluateStoredProviderFinancialStanding(tx, {
    providerIdentityId: identity.id,
    providerType: input.providerType,
    countryCode: input.countryCode,
    currency: input.currency,
  })

  if (!standing.decision.onlineJobsAllowed) {
    const error = new Error('PROVIDER_ONLINE_RESTRICTED')
    ;(error as Error & { code?: string }).code = 'PROVIDER_ONLINE_RESTRICTED'
    throw error
  }

  return {
    providerIdentity: identity,
    ...standing,
  }
}

export async function recordCashPlatformReceivable(
  tx: Prisma.TransactionClient,
  input: {
    jobId: string
    escrowId: string
    providerId: string
    providerType: FinancialProviderType
    countryCode: string
    currency: string
    platformDueMinor: bigint
    weeklySettlementId?: string | null
    createdBy: string
  },
) {
  if (input.platformDueMinor <= 0n) {
    return {
      recorded: false,
      replayed: false,
      commissionDueMinor: 0n,
      standing: 'CLEAR' as const,
      cashJobsAllowed: true,
      onlineJobsAllowed: true,
    }
  }

  const identity = await ensureProviderIdentity(tx, input)
  const currency = input.currency.trim().toUpperCase()
  const idempotencyKey = `cash-platform-receivable:${input.escrowId}`

  const existing = await tx.idempotencyRecord.findUnique({
    where: { idempotencyKey },
    select: { status: true },
  })

  if (existing?.status === 'COMPLETED') {
    const current = await evaluateStoredProviderFinancialStanding(tx, {
      providerIdentityId: identity.id,
      providerType: input.providerType,
      countryCode: input.countryCode,
      currency,
    })
    return {
      recorded: false,
      replayed: true,
      commissionDueMinor: current.account.commissionDue,
      standing: current.decision.standing,
      cashJobsAllowed: current.decision.cashJobsAllowed,
      onlineJobsAllowed: current.decision.onlineJobsAllowed,
    }
  }
  if (existing?.status === 'PENDING') {
    throw new Error('CASH_RECEIVABLE_ALREADY_PENDING')
  }

  const account = await ensureFinancialAccount(tx, identity.id, currency)
  const dueAt = account.oldestCommissionDueAt ?? new Date()

  await postLedgerTransaction({
    entries: [
      {
        accountId: `provider-receivable:${identity.id}`,
        accountType: 'PROVIDER_COMMISSION_RECEIVABLE',
        entryType: 'DEBIT',
        amount: input.platformDueMinor,
      },
      {
        accountId: 'platform',
        accountType: 'PLATFORM',
        entryType: 'CREDIT',
        amount: input.platformDueMinor,
      },
    ],
    currency: currency as Currency,
    referenceType: 'CASH_PLATFORM_RECEIVABLE',
    referenceId: input.escrowId,
    idempotencyKey,
    description: `Cash-job platform receivable for job ${input.jobId}`,
    createdBy: input.createdBy,
    metadata: JSON.stringify({
      jobId: input.jobId,
      escrowId: input.escrowId,
      providerIdentityId: identity.id,
      providerId: input.providerId,
      providerType: input.providerType,
      countryCode: input.countryCode,
      currency,
    }),
  }, tx)

  await tx.providerCommissionReceivable.create({
    data: {
      providerIdentityId: identity.id,
      weeklySettlementId: input.weeklySettlementId || null,
      jobId: input.jobId,
      escrowId: input.escrowId,
      currency,
      amountOriginal: input.platformDueMinor,
      amountRemaining: input.platformDueMinor,
      status: 'OPEN',
      dueAt,
    },
  })

  const updatedAccount = await tx.providerFinancialAccount.update({
    where: { id: account.id },
    data: {
      commissionDue: { increment: input.platformDueMinor },
      oldestCommissionDueAt: dueAt,
      version: { increment: 1 },
    },
  })

  const policy = await resolveProviderFinancialPolicy(tx, {
    countryCode: input.countryCode,
    providerType: input.providerType,
    currency,
  })
  const decision = evaluateAccountFinancialStanding(updatedAccount, policy)

  const finalAccount = await tx.providerFinancialAccount.update({
    where: { id: account.id },
    data: {
      status: decision.standing,
      cashJobsAllowed: decision.cashJobsAllowed,
      onlineJobsAllowed: decision.onlineJobsAllowed,
      manualReviewRequired: decision.manualReviewRequired,
      lastEvaluatedAt: new Date(),
      version: { increment: 1 },
    },
  })

  await tx.providerIdentity.update({
    where: { id: identity.id },
    data: { standingStatus: identityStanding(decision) },
  })

  if (decision.manualReviewRequired) {
    await tx.providerIntegritySignal.create({
      data: {
        providerIdentityId: identity.id,
        userId: identity.currentUserId,
        jobId: input.jobId,
        signalType: 'PROVIDER_FINANCIAL_REVIEW_REQUIRED',
        severity: 'HIGH',
        source: 'CASH_COMMISSION',
        metadata: JSON.stringify({
          commissionDueMinor: finalAccount.commissionDue.toString(),
          currency,
          reason: decision.reason,
          debtAgeDays: decision.debtAgeDays,
        }),
      },
    })
  }

  return {
    recorded: true,
    replayed: false,
    commissionDueMinor: finalAccount.commissionDue,
    standing: decision.standing,
    cashJobsAllowed: decision.cashJobsAllowed,
    onlineJobsAllowed: decision.onlineJobsAllowed,
  }
}

export async function recordProviderBalanceAdjustment(
  tx: Prisma.TransactionClient,
  input: {
    providerId: string
    providerType: FinancialProviderType
    countryCode: string
    currency: string
    jobId: string
    escrowId: string
    paymentIntentId?: string | null
    adjustmentType: string
    sourceProvider: string
    sourceReference: string
    amountMinor: bigint
    reason: string
    createdBy: string
    metadata?: Record<string, unknown> | null
  },
) {
  if (input.amountMinor <= 0n) {
    return { recorded: false, replayed: false, adjustmentId: null as string | null, amountMinor: 0n }
  }

  const currency = input.currency.trim().toUpperCase()
  const sourceProvider = input.sourceProvider.trim().toUpperCase()
  const adjustmentType = input.adjustmentType.trim().toUpperCase()
  const sourceReference = input.sourceReference.trim()
  const identity = await ensureProviderIdentity(tx, input)
  const idempotencyKey =
    `provider-balance-adjustment:${sourceProvider}:${adjustmentType}:${sourceReference}`

  const existing = await tx.providerBalanceAdjustment.findUnique({ where: { idempotencyKey } })
  if (existing) {
    return {
      recorded: false,
      replayed: true,
      adjustmentId: existing.id,
      amountMinor: existing.amountOriginal,
    }
  }

  const account = await ensureFinancialAccount(tx, identity.id, currency)
  const dueAt = new Date()

  await postLedgerTransaction({
    entries: [
      {
        accountId: `provider-adjustment-receivable:${identity.id}`,
        accountType: 'PROVIDER_BALANCE_ADJUSTMENT_RECEIVABLE',
        entryType: 'DEBIT',
        amount: input.amountMinor,
      },
      {
        accountId: `chargeback-clearing:${sourceProvider}`,
        accountType: 'CHARGEBACK_CLEARING',
        entryType: 'CREDIT',
        amount: input.amountMinor,
      },
    ],
    currency: currency as Currency,
    referenceType: 'PROVIDER_BALANCE_ADJUSTMENT',
    referenceId: input.paymentIntentId || input.escrowId,
    idempotencyKey: `ledger:${idempotencyKey}`,
    description: input.reason,
    createdBy: input.createdBy,
    metadata: JSON.stringify({
      providerIdentityId: identity.id,
      providerId: input.providerId,
      providerType: input.providerType,
      jobId: input.jobId,
      escrowId: input.escrowId,
      paymentIntentId: input.paymentIntentId || null,
      adjustmentType,
      sourceProvider,
      sourceReference,
      ...(input.metadata || {}),
    }),
  }, tx)

  const adjustment = await tx.providerBalanceAdjustment.create({
    data: {
      providerIdentityId: identity.id,
      jobId: input.jobId,
      escrowId: input.escrowId,
      paymentIntentId: input.paymentIntentId || null,
      adjustmentType,
      sourceProvider,
      sourceReference,
      amountOriginal: input.amountMinor,
      amountRemaining: input.amountMinor,
      currency,
      status: 'OPEN',
      dueAt,
      reason: input.reason,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      idempotencyKey,
    },
  })

  const updatedAccount = await tx.providerFinancialAccount.update({
    where: { id: account.id },
    data: {
      adjustmentDue: { increment: input.amountMinor },
      oldestAdjustmentDueAt: account.oldestAdjustmentDueAt || dueAt,
      version: { increment: 1 },
    },
  })
  const policy = await resolveProviderFinancialPolicy(tx, {
    countryCode: input.countryCode,
    providerType: input.providerType,
    currency,
  })
  const standing = evaluateAccountFinancialStanding(updatedAccount, policy)
  const finalAccount = await tx.providerFinancialAccount.update({
    where: { id: account.id },
    data: {
      status: standing.standing,
      cashJobsAllowed: standing.cashJobsAllowed,
      onlineJobsAllowed: standing.onlineJobsAllowed,
      manualReviewRequired: standing.manualReviewRequired,
      lastEvaluatedAt: dueAt,
      version: { increment: 1 },
    },
  })
  await tx.providerIdentity.update({
    where: { id: identity.id },
    data: { standingStatus: identityStanding(standing) },
  })
  await tx.providerIntegritySignal.create({
    data: {
      providerIdentityId: identity.id,
      userId: identity.currentUserId,
      jobId: input.jobId,
      signalType: 'POST_PAYOUT_PROVIDER_BALANCE_ADJUSTMENT',
      severity: 'CRITICAL',
      source: sourceProvider,
      status: 'OPEN',
      metadata: JSON.stringify({
        adjustmentId: adjustment.id,
        adjustmentType,
        amountMinor: input.amountMinor.toString(),
        currency,
        sourceReference,
        reason: input.reason,
      }),
    },
  })

  return {
    recorded: true,
    replayed: false,
    adjustmentId: adjustment.id,
    amountMinor: input.amountMinor,
    totalAdjustmentDueMinor: finalAccount.adjustmentDue,
  }
}

export async function recordPostPayoutProviderAdjustmentForEscrow(
  tx: Prisma.TransactionClient,
  input: {
    escrowId: string
    paymentIntentId: string
    sourceProvider: string
    sourceReference: string
    adjustmentType: string
    reason: string
    createdBy: string
    metadata?: Record<string, unknown> | null
  },
) {
  const escrow = await tx.jobEscrow.findUnique({
    where: { id: input.escrowId },
    select: { id: true, jobId: true, quoteId: true, providerId: true, currency: true, status: true },
  })
  if (!escrow || escrow.status !== 'RELEASED') {
    return { recorded: false, replayed: false, adjustmentId: null as string | null, amountMinor: 0n }
  }

  const [quote, job, providerCredit] = await Promise.all([
    tx.jobQuote.findUnique({
      where: { id: escrow.quoteId },
      select: { providerId: true, providerType: true },
    }),
    tx.marketplaceJob.findUnique({
      where: { id: escrow.jobId },
      select: { countryCode: true },
    }),
    tx.financialLedger.aggregate({
      where: {
        referenceType: 'ESCROW_RELEASE',
        referenceId: escrow.id,
        accountType: 'PROVIDER_WALLET',
        entryType: 'CREDIT',
        currency: escrow.currency,
      },
      _sum: { amount: true },
    }),
  ])

  if (
    !quote ||
    quote.providerId !== escrow.providerId ||
    (quote.providerType !== 'INDIVIDUAL' && quote.providerType !== 'COMPANY')
  ) {
    throw new Error('POST_PAYOUT_ADJUSTMENT_PROVIDER_MISMATCH')
  }

  const amountMinor = providerCredit._sum.amount ?? 0n
  if (amountMinor <= 0n) {
    return { recorded: false, replayed: false, adjustmentId: null as string | null, amountMinor: 0n }
  }

  return recordProviderBalanceAdjustment(tx, {
    providerId: quote.providerId,
    providerType: quote.providerType,
    countryCode: job?.countryCode || 'LK',
    currency: escrow.currency,
    jobId: escrow.jobId,
    escrowId: escrow.id,
    paymentIntentId: input.paymentIntentId,
    adjustmentType: input.adjustmentType,
    sourceProvider: input.sourceProvider,
    sourceReference: input.sourceReference,
    amountMinor,
    reason: input.reason,
    createdBy: input.createdBy,
    metadata: input.metadata,
  })
}

export async function recoverProviderCommissionFromOnlineEarnings(
  tx: Prisma.TransactionClient,
  input: {
    providerId: string
    providerType: FinancialProviderType
    countryCode: string
    currency: string
    availableOnlineEarningsMinor: bigint
    sourceJobId: string
    sourceEscrowId: string
    createdBy: string
  },
) {
  const currency = input.currency.trim().toUpperCase()
  const identity = await ensureProviderIdentity(tx, input)
  const account = await ensureFinancialAccount(tx, identity.id, currency)

  const lockedRows = await tx.$queryRaw<Array<{
    id: string
    commissionDue: string
    adjustmentDue: string
    oldestCommissionDueAt: Date | null
    oldestAdjustmentDueAt: Date | null
  }>>`
    SELECT id,
           "commissionDue"::text AS "commissionDue",
           "adjustmentDue"::text AS "adjustmentDue",
           "oldestCommissionDueAt",
           "oldestAdjustmentDueAt"
    FROM "ProviderFinancialAccount"
    WHERE id = ${account.id}
    FOR UPDATE
  `

  const locked = lockedRows[0]
  if (!locked) throw new Error('PROVIDER_FINANCIAL_ACCOUNT_NOT_FOUND')

  const currentCommissionDue = BigInt(locked.commissionDue)
  const currentAdjustmentDue = BigInt(locked.adjustmentDue)
  const earnings = input.availableOnlineEarningsMinor > 0n ? input.availableOnlineEarningsMinor : 0n
  const currentTotalDue = currentCommissionDue + currentAdjustmentDue
  const policy = await resolveProviderFinancialPolicy(tx, {
    countryCode: input.countryCode,
    providerType: input.providerType,
    currency,
  })

  const decision = calculateOnlineDebtOffset({
    availableOnlineEarningsMinor: earnings,
    commissionDueMinor: currentTotalDue,
    autoOffsetEnabled: policy.autoOffsetOnlineEarnings,
  })

  let remainingToRecover = decision.recoveryMinor
  let commissionRecoveryMinor = 0n
  let adjustmentRecoveryMinor = 0n
  const allocations: Array<{ receivableId: string; amount: bigint }> = []
  const adjustmentAllocations: Array<{ adjustmentId: string; amount: bigint }> = []
  const touchedSettlements = new Set<string>()

  if (remainingToRecover > 0n) {
    const receivables = await tx.providerCommissionReceivable.findMany({
      where: {
        providerIdentityId: identity.id,
        currency,
        status: { in: ['OPEN', 'PARTIAL'] },
        amountRemaining: { gt: 0 },
        OR: [
          { weeklySettlementId: null },
          { weeklySettlement: { commissionPayments: { none: { status: 'PENDING' } } } },
        ],
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    })

    for (const receivable of receivables) {
      if (remainingToRecover <= 0n) break
      const allocation = receivable.amountRemaining < remainingToRecover
        ? receivable.amountRemaining
        : remainingToRecover
      if (allocation <= 0n) continue
      const newRemaining = receivable.amountRemaining - allocation

      await tx.providerCommissionReceivable.update({
        where: { id: receivable.id },
        data: {
          amountRemaining: newRemaining,
          status: newRemaining === 0n ? 'SETTLED' : 'PARTIAL',
          settledAt: newRemaining === 0n ? new Date() : null,
        },
      })
      await tx.providerCommissionRecovery.create({
        data: {
          receivableId: receivable.id,
          providerIdentityId: identity.id,
          sourceJobId: input.sourceJobId,
          sourceEscrowId: input.sourceEscrowId,
          amount: allocation,
          currency,
          method: 'ONLINE_EARNINGS',
          idempotencyKey: `online-recovery:${input.sourceEscrowId}:${receivable.id}`,
          createdBy: input.createdBy,
        },
      })
      if (receivable.weeklySettlementId) touchedSettlements.add(receivable.weeklySettlementId)
      allocations.push({ receivableId: receivable.id, amount: allocation })
      commissionRecoveryMinor += allocation
      remainingToRecover -= allocation
    }
  }

  if (remainingToRecover > 0n) {
    const adjustments = await tx.providerBalanceAdjustment.findMany({
      where: {
        providerIdentityId: identity.id,
        currency,
        status: { in: ['OPEN', 'PARTIAL'] },
        amountRemaining: { gt: 0 },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    })
    for (const adjustment of adjustments) {
      if (remainingToRecover <= 0n) break
      const allocation = adjustment.amountRemaining < remainingToRecover
        ? adjustment.amountRemaining
        : remainingToRecover
      if (allocation <= 0n) continue
      const newRemaining = adjustment.amountRemaining - allocation

      await tx.providerBalanceAdjustment.update({
        where: { id: adjustment.id },
        data: {
          amountRemaining: newRemaining,
          status: newRemaining === 0n ? 'SETTLED' : 'PARTIAL',
          settledAt: newRemaining === 0n ? new Date() : null,
        },
      })
      await tx.providerBalanceAdjustmentRecovery.create({
        data: {
          adjustmentId: adjustment.id,
          providerIdentityId: identity.id,
          sourceJobId: input.sourceJobId,
          sourceEscrowId: input.sourceEscrowId,
          amount: allocation,
          currency,
          method: 'ONLINE_EARNINGS',
          idempotencyKey: `online-adjustment-recovery:${input.sourceEscrowId}:${adjustment.id}`,
          createdBy: input.createdBy,
        },
      })
      adjustmentAllocations.push({ adjustmentId: adjustment.id, amount: allocation })
      adjustmentRecoveryMinor += allocation
      remainingToRecover -= allocation
    }
  }

  for (const weeklySettlementId of touchedSettlements) {
    const unresolved = await tx.providerCommissionReceivable.count({
      where: {
        weeklySettlementId,
        status: { in: ['OPEN', 'PARTIAL'] },
        amountRemaining: { gt: 0 },
      },
    })
    if (unresolved === 0) {
      await tx.weeklySettlement.updateMany({
        where: { id: weeklySettlementId, commissionPaid: false },
        data: {
          commissionPaid: true,
          paidAt: new Date(),
          status: 'PAID',
          suspendedAt: null,
          notes: 'Automatically recovered from future online earnings',
        },
      })
    }
  }

  const remainingCommissionDue = currentCommissionDue > commissionRecoveryMinor
    ? currentCommissionDue - commissionRecoveryMinor
    : 0n
  const remainingAdjustmentDue = currentAdjustmentDue > adjustmentRecoveryMinor
    ? currentAdjustmentDue - adjustmentRecoveryMinor
    : 0n
  const [oldestCommission, oldestAdjustment] = await Promise.all([
    tx.providerCommissionReceivable.findFirst({
      where: {
        providerIdentityId: identity.id,
        currency,
        status: { in: ['OPEN', 'PARTIAL'] },
        amountRemaining: { gt: 0 },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
      select: { dueAt: true },
    }),
    tx.providerBalanceAdjustment.findFirst({
      where: {
        providerIdentityId: identity.id,
        currency,
        status: { in: ['OPEN', 'PARTIAL'] },
        amountRemaining: { gt: 0 },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
      select: { dueAt: true },
    }),
  ])

  const standing = evaluateAccountFinancialStanding(
    {
      commissionDue: remainingCommissionDue,
      adjustmentDue: remainingAdjustmentDue,
      oldestCommissionDueAt: oldestCommission?.dueAt || null,
      oldestAdjustmentDueAt: oldestAdjustment?.dueAt || null,
    },
    policy,
  )
  await tx.providerFinancialAccount.update({
    where: { id: account.id },
    data: {
      commissionDue: remainingCommissionDue,
      adjustmentDue: remainingAdjustmentDue,
      oldestCommissionDueAt: oldestCommission?.dueAt || null,
      oldestAdjustmentDueAt: oldestAdjustment?.dueAt || null,
      status: standing.standing,
      cashJobsAllowed: standing.cashJobsAllowed,
      onlineJobsAllowed: standing.onlineJobsAllowed,
      manualReviewRequired: standing.manualReviewRequired,
      lastEvaluatedAt: new Date(),
      version: { increment: 1 },
    },
  })
  await tx.providerIdentity.update({
    where: { id: identity.id },
    data: { standingStatus: identityStanding(standing) },
  })

  const actualRecovery = commissionRecoveryMinor + adjustmentRecoveryMinor
  return {
    providerIdentityId: identity.id,
    recoveryMinor: actualRecovery,
    commissionRecoveryMinor,
    adjustmentRecoveryMinor,
    providerPayoutMinor: earnings > actualRecovery ? earnings - actualRecovery : 0n,
    remainingCommissionDueMinor: remainingCommissionDue,
    remainingAdjustmentDueMinor: remainingAdjustmentDue,
    allocations,
    adjustmentAllocations,
  }
}

export async function settleProviderReceivablesFromDirectPayment(
  tx: Prisma.TransactionClient,
  input: {
    weeklySettlementId: string
    commissionPaymentId: string
    amountPaidMinor: bigint
    currency: string
    createdBy: string
  },
) {
  const currency = input.currency.trim().toUpperCase()
  if (input.amountPaidMinor <= 0n) {
    throw new Error('DIRECT_COMMISSION_PAYMENT_AMOUNT_INVALID')
  }

  const receivables = await tx.providerCommissionReceivable.findMany({
    where: {
      weeklySettlementId: input.weeklySettlementId,
      currency,
      status: { in: ['OPEN', 'PARTIAL'] },
      amountRemaining: { gt: 0 },
    },
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    include: {
      providerIdentity: {
        select: {
          id: true,
          identityType: true,
          countryCode: true,
        },
      },
    },
  })

  // Historical weekly settlements predate the durable receivable layer.
  // Keep their legacy reconciliation path working without inventing balances.
  if (receivables.length === 0) {
    return {
      featureBacked: false,
      recoveredMinor: 0n,
      remainingCommissionDueMinor: 0n,
      providerIdentityId: null as string | null,
    }
  }

  const providerIdentityIds = [...new Set(receivables.map(item => item.providerIdentityId))]
  if (providerIdentityIds.length !== 1) {
    throw new Error('DIRECT_COMMISSION_PAYMENT_IDENTITY_MISMATCH')
  }

  const outstandingMinor = receivables.reduce(
    (sum, item) => sum + item.amountRemaining,
    0n,
  )
  if (outstandingMinor !== input.amountPaidMinor) {
    throw new Error('DIRECT_COMMISSION_PAYMENT_AMOUNT_MISMATCH')
  }

  const identity = receivables[0].providerIdentity
  const account = await tx.providerFinancialAccount.findUnique({
    where: {
      providerIdentityId_currency: {
        providerIdentityId: identity.id,
        currency,
      },
    },
  })
  if (!account) {
    throw new Error('PROVIDER_FINANCIAL_ACCOUNT_NOT_FOUND')
  }

  await postLedgerTransaction({
    entries: [
      {
        accountId: `commission-clearing:${currency}`,
        accountType: 'PLATFORM_CASH_CLEARING',
        entryType: 'DEBIT',
        amount: input.amountPaidMinor,
      },
      {
        accountId: `provider-receivable:${identity.id}`,
        accountType: 'PROVIDER_COMMISSION_RECEIVABLE',
        entryType: 'CREDIT',
        amount: input.amountPaidMinor,
      },
    ],
    currency: currency as Currency,
    referenceType: 'COMMISSION_PAYMENT',
    referenceId: input.commissionPaymentId,
    idempotencyKey: `commission-payment-recovery:${input.commissionPaymentId}`,
    description: `Direct provider commission settlement ${input.commissionPaymentId}`,
    createdBy: input.createdBy,
    metadata: JSON.stringify({
      weeklySettlementId: input.weeklySettlementId,
      providerIdentityId: identity.id,
      currency,
    }),
  }, tx)

  const settledAt = new Date()
  for (const receivable of receivables) {
    await tx.providerCommissionReceivable.update({
      where: { id: receivable.id },
      data: {
        amountRemaining: 0n,
        status: 'SETTLED',
        settledAt,
      },
    })

    await tx.providerCommissionRecovery.create({
      data: {
        receivableId: receivable.id,
        providerIdentityId: identity.id,
        amount: receivable.amountRemaining,
        currency,
        method: 'DIRECT_SETTLEMENT',
        idempotencyKey: `direct-settlement:${input.commissionPaymentId}:${receivable.id}`,
        createdBy: input.createdBy,
      },
    })
  }

  const previousDue = account.commissionDue
  const remainingDue = previousDue > input.amountPaidMinor
    ? previousDue - input.amountPaidMinor
    : 0n

  const oldestRemaining = await tx.providerCommissionReceivable.findFirst({
    where: {
      providerIdentityId: identity.id,
      currency,
      status: { in: ['OPEN', 'PARTIAL'] },
      amountRemaining: { gt: 0 },
    },
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
    select: { dueAt: true },
  })

  const providerType: FinancialProviderType =
    identity.identityType === 'COMPANY' ? 'COMPANY' : 'INDIVIDUAL'
  const policy = await resolveProviderFinancialPolicy(tx, {
    countryCode: identity.countryCode,
    providerType,
    currency,
  })
  const standing = evaluateAccountFinancialStanding(
    {
      commissionDue: remainingDue,
      adjustmentDue: account.adjustmentDue,
      oldestCommissionDueAt: oldestRemaining?.dueAt || null,
      oldestAdjustmentDueAt: account.oldestAdjustmentDueAt,
    },
    policy,
  )

  await tx.providerFinancialAccount.update({
    where: { id: account.id },
    data: {
      commissionDue: remainingDue,
      oldestCommissionDueAt: oldestRemaining?.dueAt || null,
      status: standing.standing,
      cashJobsAllowed: standing.cashJobsAllowed,
      onlineJobsAllowed: standing.onlineJobsAllowed,
      manualReviewRequired: standing.manualReviewRequired,
      lastEvaluatedAt: settledAt,
      version: { increment: 1 },
    },
  })

  await tx.providerIdentity.update({
    where: { id: identity.id },
    data: { standingStatus: identityStanding(standing) },
  })

  return {
    featureBacked: true,
    recoveredMinor: input.amountPaidMinor,
    remainingCommissionDueMinor: remainingDue,
    providerIdentityId: identity.id,
  }
}

export async function readProviderFinancialAccountForUser(
  tx: Prisma.TransactionClient,
  input: {
    userId: string
    providerType: 'TASKER' | 'COMPANY'
    currency: string
  },
) {
  const currency = input.currency.trim().toUpperCase()

  if (input.providerType === 'COMPANY') {
    const company = await tx.companyProfile.findUnique({
      where: { userId: input.userId },
      select: { id: true, countryCode: true },
    })
    if (!company) return null
    const identity = await tx.providerIdentity.findUnique({
      where: {
        identityType_subjectId: {
          identityType: 'COMPANY',
          subjectId: company.id,
        },
      },
    })
    if (!identity) return null
    return tx.providerFinancialAccount.findUnique({
      where: {
        providerIdentityId_currency: {
          providerIdentityId: identity.id,
          currency,
        },
      },
    })
  }

  const tasker = await tx.taskerProfile.findUnique({
    where: { userId: input.userId },
    select: { id: true },
  })
  if (!tasker) return null
  const identity = await tx.providerIdentity.findUnique({
    where: {
      identityType_subjectId: {
        identityType: 'TASKER',
        subjectId: tasker.id,
      },
    },
  })
  if (!identity) return null
  return tx.providerFinancialAccount.findUnique({
    where: {
      providerIdentityId_currency: {
        providerIdentityId: identity.id,
        currency,
      },
    },
  })
}
