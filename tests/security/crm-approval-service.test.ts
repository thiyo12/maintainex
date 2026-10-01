import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  approvalFindUnique: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    crmApprovalRequest: {
      findUnique: db.approvalFindUnique,
    },
    $transaction: db.transaction,
  },
}))

import {
  CrmApprovalError,
  createCrmApprovalRequest,
  decideCrmApprovalRequest,
} from '@/lib/crm/governance/approval-service'

const lkr = (major: number) => BigInt(major) * 100n

describe('CRM V2 approval service security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects a refund above remaining refundable amount before DB mutation', async () => {
    await expect(createCrmApprovalRequest({
      actionId: 'finance.refund',
      initiatorAdminId: 'finance-1',
      market: 'LK',
      targetType: 'PaymentIntent',
      targetId: 'payment-1',
      amountMinor: lkr(50_000),
      currency: 'LKR',
      risk: {
        remainingRefundableMinor: lkr(20_000),
      },
    })).rejects.toMatchObject<Partial<CrmApprovalError>>({
      code: 'CRM_ACTION_PROHIBITED',
    })

    expect(db.transaction).not.toHaveBeenCalled()
    expect(db.approvalFindUnique).not.toHaveBeenCalled()
  })

  it('reuses an existing approval request for the same idempotency key', async () => {
    const existing = {
      id: 'approval-1',
      idempotencyKey: 'refund:payment-1:v1',
      status: 'PENDING_APPROVAL',
    }
    db.approvalFindUnique.mockResolvedValueOnce(existing)

    const result = await createCrmApprovalRequest({
      actionId: 'finance.refund',
      initiatorAdminId: 'finance-1',
      market: 'LK',
      targetType: 'PaymentIntent',
      targetId: 'payment-1',
      amountMinor: lkr(10_000),
      currency: 'LKR',
      idempotencyKey: 'refund:payment-1:v1',
      risk: {
        remainingRefundableMinor: lkr(10_000),
      },
    })

    expect(result.reused).toBe(true)
    expect(result.request).toBe(existing)
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('requires step-up authentication before a finance approval', async () => {
    db.approvalFindUnique.mockResolvedValueOnce({
      id: 'approval-2',
      actionId: 'finance.refund',
      status: 'PENDING_APPROVAL',
      initiatorAdminId: 'finance-1',
      market: 'LK',
      targetType: 'PaymentIntent',
      targetId: 'payment-2',
      amountMinor: lkr(10_000),
      currency: 'LKR',
      tier: 'T1',
      expiresAt: new Date(Date.now() + 60_000),
      decisions: [],
    })

    await expect(decideCrmApprovalRequest({
      requestId: 'approval-2',
      approverAdminId: 'finance-1',
      approverRole: 'FINANCE',
      decision: 'APPROVE',
      stepUpVerified: false,
      currentRisk: {
        remainingRefundableMinor: lkr(10_000),
      },
    })).rejects.toMatchObject<Partial<CrmApprovalError>>({
      code: 'STEP_UP_REQUIRED',
    })

    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('blocks self approval for a T2 refund', async () => {
    db.approvalFindUnique.mockResolvedValueOnce({
      id: 'approval-3',
      actionId: 'finance.refund',
      status: 'PENDING_APPROVAL',
      initiatorAdminId: 'finance-1',
      market: 'LK',
      targetType: 'PaymentIntent',
      targetId: 'payment-3',
      amountMinor: lkr(75_000),
      currency: 'LKR',
      tier: 'T2',
      expiresAt: new Date(Date.now() + 60_000),
      decisions: [],
    })

    await expect(decideCrmApprovalRequest({
      requestId: 'approval-3',
      approverAdminId: 'finance-1',
      approverRole: 'FINANCE',
      decision: 'APPROVE',
      stepUpVerified: true,
      currentRisk: {
        remainingRefundableMinor: lkr(75_000),
      },
    })).rejects.toMatchObject<Partial<CrmApprovalError>>({
      code: 'SELF_APPROVAL_FORBIDDEN',
    })

    expect(db.transaction).not.toHaveBeenCalled()
  })
})
