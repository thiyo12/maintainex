import { prisma } from '@/lib/prisma'
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
        select: { status: true },
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
        activeDispute: Boolean(dispute && dispute.status !== 'RESOLVED'),
        manualAfterRelease: escrow?.status === 'RELEASED',
        activeChargeback: intent.status === 'CHARGEDBACK',
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
