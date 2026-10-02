import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  updateMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    crmStepUpGrant: {
      updateMany: db.updateMany,
    },
  },
}))

import {
  consumeCrmStepUpProof,
  crmStepUpExpiresAt,
  isVerifiedCrmStepUp,
  signCrmStepUpToken,
} from '@/lib/crm/governance/step-up'

describe('CRM one-time step-up proof', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-step-up-secret-that-is-long-enough-for-tests'
  })

  it('binds proof to admin session and exact action', async () => {
    const token = signCrmStepUpToken({
      grantId: 'grant-1',
      adminUserId: 'admin-1',
      sessionId: 'session-1',
      actionId: 'finance.refund',
    })

    const wrongAction = await consumeCrmStepUpProof({
      token,
      adminUserId: 'admin-1',
      sessionId: 'session-1',
      actionId: 'finance.payout',
    })

    expect(wrongAction).toBeNull()
    expect(db.updateMany).not.toHaveBeenCalled()
  })

  it('consumes a valid proof exactly once', async () => {
    const token = signCrmStepUpToken({
      grantId: 'grant-2',
      adminUserId: 'admin-2',
      sessionId: 'session-2',
      actionId: 'finance.refund',
    })

    db.updateMany.mockResolvedValueOnce({ count: 1 })
    const first = await consumeCrmStepUpProof({
      token,
      adminUserId: 'admin-2',
      sessionId: 'session-2',
      actionId: 'finance.refund',
    })
    expect(isVerifiedCrmStepUp(first)).toBe(true)

    db.updateMany.mockResolvedValueOnce({ count: 0 })
    const replay = await consumeCrmStepUpProof({
      token,
      adminUserId: 'admin-2',
      sessionId: 'session-2',
      actionId: 'finance.refund',
    })
    expect(replay).toBeNull()
  })

  it('expires grants after five minutes', () => {
    const now = new Date('2026-10-01T10:00:00Z')
    expect(crmStepUpExpiresAt(now).toISOString()).toBe('2026-10-01T10:05:00.000Z')
  })
})
