import { prisma } from '@/lib/prisma'
import { getActiveEmergencyControl } from '@/lib/crm/emergency-controls'
import { inspectCrmJobCancellation } from '@/lib/crm/jobs/cancellation'
import type { CrmActionId, RiskPolicyContext } from './types'

export interface ApprovalRiskResolution {
  actionId: CrmActionId
  market: string
  amountMinor?: bigint
  currency?: string
  risk: Omit<RiskPolicyContext, 'actionId' | 'market' | 'amountMinor' | 'currency'>
}

export async function resolveCurrentApprovalRisk(request: {
  actionId: string
  market: string
  targetType: string
  targetId: string
  amountMinor: bigint | null
  currency: string | null
}): Promise<ApprovalRiskResolution> {
  if (request.actionId === 'finance.refund') {
    if (request.targetType !== 'PaymentIntent') {
      throw new Error('APPROVAL_TARGET_TYPE_INVALID')
    }

    const intent = await prisma.paymentIntent.findUnique({
      where: { id: request.targetId },
      select: {
        id: true,
        jobId: true,
        escrowId: true,
        amount: true,
        currency: true,
        status: true,
      },
    })
    if (!intent) throw new Error('APPROVAL_TARGET_NOT_FOUND')

    const [job, escrow, dispute] = await Promise.all([
      prisma.marketplaceJob.findUnique({
        where: { id: intent.jobId },
        select: { countryCode: true },
      }),
      prisma.jobEscrow.findUnique({
        where: { id: intent.escrowId },
        select: { status: true },
      }),
      prisma.marketplaceDispute.findUnique({
        where: { jobId: intent.jobId },
        select: { status: true, resolutionAction: true },
      }),
    ])

    if (!job) throw new Error('APPROVAL_TARGET_NOT_FOUND')
    if (job.countryCode.toUpperCase() !== request.market.toUpperCase()) {
      throw new Error('APPROVAL_MARKET_CHANGED')
    }
    if (request.amountMinor !== null && request.amountMinor !== intent.amount) {
      throw new Error('APPROVAL_AMOUNT_CHANGED')
    }
    if (request.currency && request.currency.toUpperCase() !== intent.currency.toUpperCase()) {
      throw new Error('APPROVAL_CURRENCY_CHANGED')
    }

    const refundable = ['REFUND_REQUIRED', 'REFUND_PROCESSING'].includes(intent.status)

    return {
      actionId: 'finance.refund',
      market: job.countryCode,
      amountMinor: intent.amount,
      currency: intent.currency,
      risk: {
        remainingRefundableMinor: refundable ? intent.amount : 0n,
        activeDispute: Boolean(
          dispute &&
          dispute.status !== 'RESOLVED' &&
          !(dispute.status === 'RESOLVING' && dispute.resolutionAction === 'REFUND_CUSTOMER')
        ),
        manualAfterRelease: escrow?.status === 'RELEASED',
        activeChargeback: intent.status === 'CHARGEDBACK',
      },
    }
  }

  if (request.actionId === 'finance.payout') {
    if (request.targetType !== 'Payout') {
      throw new Error('APPROVAL_TARGET_TYPE_INVALID')
    }

    const payout = await prisma.payout.findUnique({
      where: { id: request.targetId },
      select: {
        id: true,
        userId: true,
        amount: true,
        currency: true,
        countryCode: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            identityStatus: true,
            isSuspended: true,
            isBanned: true,
            taskerProfile: {
              select: {
                verificationStatus: true,
                isVerified: true,
              },
            },
            companyProfile: {
              select: {
                verificationStatus: true,
                isVerified: true,
              },
            },
          },
        },
      },
    })
    if (!payout) throw new Error('APPROVAL_TARGET_NOT_FOUND')

    if (payout.countryCode.toUpperCase() !== request.market.toUpperCase()) {
      throw new Error('APPROVAL_MARKET_CHANGED')
    }
    if (request.amountMinor !== null && request.amountMinor !== payout.amount) {
      throw new Error('APPROVAL_AMOUNT_CHANGED')
    }
    if (request.currency && request.currency.toUpperCase() !== payout.currency.toUpperCase()) {
      throw new Error('APPROVAL_CURRENCY_CHANGED')
    }

    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [priorSucceededCount, recipient24h, recipient7d, payoutFreeze] = await Promise.all([
      prisma.payout.count({
        where: {
          userId: payout.userId,
          status: 'SUCCEEDED',
          id: { not: payout.id },
        },
      }),
      prisma.payout.aggregate({
        where: {
          userId: payout.userId,
          createdAt: { gte: dayAgo },
          status: { in: ['RESERVED', 'PROCESSING', 'SUCCEEDED'] },
        },
        _sum: { amount: true },
      }),
      prisma.payout.aggregate({
        where: {
          userId: payout.userId,
          createdAt: { gte: weekAgo },
          status: { in: ['RESERVED', 'PROCESSING', 'SUCCEEDED'] },
        },
        _sum: { amount: true },
      }),
      getActiveEmergencyControl('PAYOUTS_FROZEN', payout.countryCode),
    ])

    const identityVerified = payout.user.identityStatus === 'VERIFIED'
    const taskerVerified = payout.user.taskerProfile
      ? payout.user.taskerProfile.verificationStatus === 'VERIFIED' &&
        payout.user.taskerProfile.isVerified
      : true
    const companyVerified = payout.user.companyProfile
      ? payout.user.companyProfile.verificationStatus === 'VERIFIED' &&
        payout.user.companyProfile.isVerified
      : true

    return {
      actionId: 'finance.payout',
      market: payout.countryCode,
      amountMinor: payout.amount,
      currency: payout.currency,
      risk: {
        kycStatus:
          identityVerified && taskerVerified && companyVerified
            ? 'APPROVED'
            : payout.user.identityStatus === 'REJECTED'
              ? 'REJECTED'
              : payout.user.identityStatus === 'EXPIRED'
                ? 'EXPIRED'
                : 'PENDING',
        fraudOrSecurityHold: payout.user.isSuspended || payout.user.isBanned,
        payoutExecutionFrozen: Boolean(payoutFreeze),
        firstPayout: priorSucceededCount === 0,
        rollingRecipientAmountMinor24h: recipient24h._sum.amount ?? payout.amount,
        rollingRecipientAmountMinor7d: recipient7d._sum.amount ?? payout.amount,
      },
    }
  }

  if (request.actionId === 'jobs.cancel') {
    const source =
      request.targetType === 'MarketplaceJob'
        ? 'V2'
        : request.targetType === 'JobPosting'
          ? 'V1'
          : null

    if (!source) {
      throw new Error('APPROVAL_TARGET_TYPE_INVALID')
    }

    const context = await inspectCrmJobCancellation(request.targetId, source)
    if (!context) {
      throw new Error('APPROVAL_TARGET_NOT_FOUND')
    }

    if (context.countryCode.toUpperCase() !== request.market.toUpperCase()) {
      throw new Error('APPROVAL_MARKET_CHANGED')
    }

    return {
      actionId: 'jobs.cancel',
      market: context.countryCode,
      amountMinor: context.amountMinor,
      currency: context.currency,
      risk: {
        jobStatus: context.status,
        hasFinancialImpact: context.hasFinancialImpact,
        financialAlreadyReleased: context.financialAlreadyReleased,
        activeDispute: context.activeDispute,
      },
    }
  }

  throw new Error('APPROVAL_ACTION_NOT_IMPLEMENTED')
}
