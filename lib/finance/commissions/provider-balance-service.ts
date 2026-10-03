import type { Prisma } from '@prisma/client'
import { postLedgerTransaction } from '@/lib/finance/ledger/ledger-service'
import type { Currency } from '@/lib/shared/money/money'
import {
  evaluateProviderFinancialStanding,
  type ProviderFinancialDecision,
  type ProviderFinancialPolicy,
} from '@/lib/finance/commissions/provider-financial-policy'

export type FinancialProviderType = 'INDIVIDUAL' | 'COMPANY'

const DEFAULT_LK_LKR_POLICY: ProviderFinancialPolicy = {
  warningThresholdMinor: 200_000n,
  cashRestrictionThresholdMinor: 500_000n,
  reviewThresholdMinor: 1_000_000n,
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
      verifiedPhotoUrl: tasker.profileImage,
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
      ...(tasker.profileImage ? { verifiedPhotoUrl: tasker.profileImage } : {}),
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
  const decision = evaluateProviderFinancialStanding(
    {
      commissionDueMinor: account.commissionDue,
      oldestCommissionDueAt: account.oldestCommissionDueAt,
    },
    policy,
  )

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
  const decision = evaluateProviderFinancialStanding({
    commissionDueMinor: updatedAccount.commissionDue,
    oldestCommissionDueAt: updatedAccount.oldestCommissionDueAt,
  }, policy)

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
