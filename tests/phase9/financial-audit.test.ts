import { describe, it, expect, vi, beforeEach } from 'vitest'
import { emitSecurityEvent } from '@/lib/security/events'
import type { SecurityEventType } from '@/lib/security/events'

vi.mock('@/lib/observability/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    companyAuditLog: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

import { logger } from '@/lib/observability/logger'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'

describe('Financial Audit — Security Event Emission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('emitSecurityEvent does not throw on wallet_withdrawal', () => {
    expect(() => {
      emitSecurityEvent({
        type: 'wallet_withdrawal',
        actorId: 'user-1',
        actorType: 'user',
        details: { amount: 5000, currency: 'LKR' },
      })
    }).not.toThrow()

    expect(logger.warn).toHaveBeenCalledTimes(1)
  })

  it('emitSecurityEvent does not throw on wallet_deposit', () => {
    expect(() => {
      emitSecurityEvent({
        type: 'wallet_deposit',
        actorId: 'user-1',
        actorType: 'user',
        details: { amount: 10000, currency: 'LKR' },
      })
    }).not.toThrow()

    expect(logger.info).toHaveBeenCalledTimes(1)
  })

  it('emitSecurityEvent does not throw on financial_amount_mismatch', () => {
    expect(() => {
      emitSecurityEvent({
        type: 'financial_amount_mismatch',
        actorId: 'user-2',
        actorType: 'user',
        details: { expected: 100, actual: 99 },
      })
    }).not.toThrow()

    expect(logger.error).toHaveBeenCalledTimes(1)
  })

  it('emitSecurityEvent does not throw on idempotency_violation', () => {
    expect(() => {
      emitSecurityEvent({
        type: 'idempotency_violation',
        actorId: 'user-3',
        actorType: 'user',
        details: { duplicateKey: 'txn-123' },
      })
    }).not.toThrow()

    expect(logger.warn).toHaveBeenCalledTimes(1)
  })

  it('emitSecurityEvent does not throw on metadata_tamper_detected', () => {
    expect(() => {
      emitSecurityEvent({
        type: 'metadata_tamper_detected',
        actorId: 'user-4',
        details: { field: 'amount', original: 100, tampered: 200 },
      })
    }).not.toThrow()

    expect(logger.error).toHaveBeenCalledTimes(1)
  })

  it('emitSecurityEvent does not throw on rate_limit_hit', () => {
    expect(() => {
      emitSecurityEvent({
        type: 'rate_limit_hit',
        actorType: 'anonymous',
        ip: '10.0.0.1',
        details: { action: 'financial_mutation', limit: 20 },
      })
    }).not.toThrow()

    expect(logger.warn).toHaveBeenCalledTimes(1)
  })

  it('emitSecurityEvent does not throw on admin_action', () => {
    expect(() => {
      emitSecurityEvent({
        type: 'admin_action',
        actorId: 'admin-1',
        actorType: 'admin',
        details: { action: 'refund_issued', jobId: 'job-abc' },
      })
    }).not.toThrow()

    expect(logger.info).toHaveBeenCalledTimes(1)
  })
})

describe('Financial Audit — Write Audit Log', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writeCompanyAuditLog does not throw with valid params', async () => {
    const { prisma } = await import('@/lib/prisma')

    await expect(writeCompanyAuditLog({
      companyId: 'company-1',
      actorId: 'user-1',
      actorRole: 'COMPANY_OWNER',
      action: 'COMPANY_CREATE',
      description: 'Company created',
    })).resolves.toBeUndefined()

    expect(prisma.companyAuditLog.create).toHaveBeenCalledTimes(1)
  })

  it('writeCompanyAuditLog passes correct data shape', async () => {
    const { prisma } = await import('@/lib/prisma')

    await writeCompanyAuditLog({
      companyId: 'company-2',
      actorId: 'user-2',
      actorRole: 'MANAGER',
      action: 'MEMBER_INVITE',
      targetType: 'user',
      targetId: 'user-3',
      description: 'Invited new member',
      metadata: { role: 'WORKER' },
      ipAddress: '127.0.0.1',
    })

    const callData = (prisma.companyAuditLog.create as any).mock.calls[0][0].data
    expect(callData.companyId).toBe('company-2')
    expect(callData.actorId).toBe('user-2')
    expect(callData.action).toBe('MEMBER_INVITE')
    expect(callData.targetType).toBe('user')
    expect(callData.targetId).toBe('user-3')
    expect(callData.ipAddress).toBe('127.0.0.1')
    expect(JSON.parse(callData.metadata)).toEqual({ role: 'WORKER' })
  })

  it('writeCompanyAuditLog handles KYC events', async () => {
    const { prisma } = await import('@/lib/prisma')

    const kycActions = ['KYC_SUBMIT', 'KYC_APPROVE', 'KYC_REJECT'] as const

    for (const action of kycActions) {
      await writeCompanyAuditLog({
        companyId: 'company-3',
        actorId: 'user-4',
        actorRole: 'FINANCE',
        action,
      })
    }

    expect(prisma.companyAuditLog.create).toHaveBeenCalledTimes(3)
  })
})
