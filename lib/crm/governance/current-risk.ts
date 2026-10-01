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
