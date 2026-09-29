import { describe, it, expect, vi } from 'vitest'
import {
  createRiskEvent,
  detectContactSharePattern,
  detectOffPlatformPayment,
  calculatePriceEscalationSignals,
  getCommercialHistory,
} from '@/lib/domain/risk-events'

function mockPrisma(overrides: Record<string, any> = {}) {
  const allChangeOrders = overrides.changeOrders ?? []
  return {
    marketplaceRiskEvent: {
      create: vi.fn().mockResolvedValue(overrides.riskEvent ?? { id: 'risk-1' }),
    },
    marketplaceJob: {
      findUnique: vi.fn().mockResolvedValue(overrides.job ?? {
        id: 'job-1',
        customerId: 'customer-1',
        approvedQuoteId: 'quote-1',
        finalAuthorizedAmountCents: 70000n,
      }),
    },
    jobQuote: {
      findUnique: vi.fn().mockResolvedValue(overrides.quote ?? {
        id: 'quote-1',
        price: 50000n,
        revisionNumber: 1,
        createdAt: new Date('2026-09-10'),
      }),
      findFirst: vi.fn().mockResolvedValue(overrides.firstQuote ?? {
        id: 'quote-1',
        price: 50000n,
        createdAt: new Date('2026-09-10'),
      }),
    },
    jobChangeOrder: {
      findMany: vi.fn().mockImplementation((args: any) => {
        if (args?.where?.status) {
          return Promise.resolve(allChangeOrders.filter((o: any) => o.status === args.where.status))
        }
        return Promise.resolve(allChangeOrders)
      }),
    },
    ...overrides,
  } as any
}

describe('Phase 10.4 — Anti-Bypass Risk Events', () => {
  describe('createRiskEvent', () => {
    it('creates a risk event', async () => {
      const client = mockPrisma()
      const result = await createRiskEvent(client, {
        jobId: 'job-1',
        actorUserId: 'user-1',
        eventType: 'CONTACT_SHARE_ATTEMPT',
        severity: 'MEDIUM',
      })
      expect(result.success).toBe(true)
      expect(result.eventId).toBe('risk-1')
      expect(client.marketplaceRiskEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          jobId: 'job-1',
          actorUserId: 'user-1',
          eventType: 'CONTACT_SHARE_ATTEMPT',
          severity: 'MEDIUM',
        }),
      })
    })

    it('defaults severity to LOW', async () => {
      const client = mockPrisma()
      await createRiskEvent(client, {
        actorUserId: 'user-1',
        eventType: 'OFF_PLATFORM_PAYMENT_LANGUAGE',
      })
      expect(client.marketplaceRiskEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ severity: 'LOW' }),
      })
    })

    it('serializes metadata to JSON', async () => {
      const client = mockPrisma()
      await createRiskEvent(client, {
        actorUserId: 'user-1',
        eventType: 'CONTACT_SHARE_ATTEMPT',
        metadata: { detectedPattern: '+94771234567', chatMessageId: 'msg-1' },
      })
      expect(client.marketplaceRiskEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: JSON.stringify({ detectedPattern: '+94771234567', chatMessageId: 'msg-1' }),
        }),
      })
    })

    it('can create jobless risk event', async () => {
      const client = mockPrisma()
      await createRiskEvent(client, {
        actorUserId: 'user-1',
        eventType: 'REPEATED_CANCELLATION_AFTER_MATCH',
      })
      expect(client.marketplaceRiskEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ jobId: null }),
      })
    })
  })

  describe('detectContactSharePattern', () => {
    it('detects phone numbers', () => {
      expect(detectContactSharePattern('Call me at +94771234567')).toBe('CONTACT_SHARE_ATTEMPT')
    })
    it('detects email addresses', () => {
      expect(detectContactSharePattern('Email me at test@gmail.com')).toBe('CONTACT_SHARE_ATTEMPT')
    })
    it('detects WhatsApp references', () => {
      expect(detectContactSharePattern('Let me share my WhatsApp')).toBe('CONTACT_SHARE_ATTEMPT')
    })
    it('detects wa.me links', () => {
      expect(detectContactSharePattern('wa.me/94771234567')).toBe('CONTACT_SHARE_ATTEMPT')
    })
    it('detects Telegram links', () => {
      expect(detectContactSharePattern('t.me/username')).toBe('CONTACT_SHARE_ATTEMPT')
    })
    it('detects Signal references', () => {
      expect(detectContactSharePattern('Find me on Signal')).toBe('CONTACT_SHARE_ATTEMPT')
    })
    it('detects Facebook links', () => {
      expect(detectContactSharePattern('facebook.com/username')).toBe('CONTACT_SHARE_ATTEMPT')
    })
    it('detects Instagram links', () => {
      expect(detectContactSharePattern('instagram.com/username')).toBe('CONTACT_SHARE_ATTEMPT')
    })
    it('returns null for clean message', () => {
      expect(detectContactSharePattern('The job looks good, I can start tomorrow')).toBeNull()
    })
    it('returns null for empty message', () => {
      expect(detectContactSharePattern('')).toBeNull()
    })
  })

  describe('detectOffPlatformPayment', () => {
    it('detects "pay me direct"', () => {
      expect(detectOffPlatformPayment('You can pay me direct')).toBe('OFF_PLATFORM_PAYMENT_LANGUAGE')
    })
    it('detects bank transfer outside', () => {
      expect(detectOffPlatformPayment('Bank transfer outside the platform')).toBe('OFF_PLATFORM_PAYMENT_LANGUAGE')
    })
    it('detects cancel and pay', () => {
      expect(detectOffPlatformPayment('Cancel the job and pay me')).toBe('OFF_PLATFORM_PAYMENT_LANGUAGE')
    })
    it('detects Venmo', () => {
      expect(detectOffPlatformPayment('Send to my Venmo')).toBe('OFF_PLATFORM_PAYMENT_LANGUAGE')
    })
    it('detects PayPal', () => {
      expect(detectOffPlatformPayment('I can accept PayPal')).toBe('OFF_PLATFORM_PAYMENT_LANGUAGE')
    })
    it('returns null for legitimate message', () => {
      expect(detectOffPlatformPayment('Payment will be released through the platform')).toBeNull()
    })
    it('returns null for empty message', () => {
      expect(detectOffPlatformPayment('')).toBeNull()
    })
  })

  describe('calculatePriceEscalationSignals', () => {
    it('calculates increase from initial to final', async () => {
      const client = mockPrisma({
        firstQuote: { id: 'q1', price: 50000n, createdAt: new Date() },
        changeOrders: [
          { amountDeltaCents: 15000n, status: 'APPROVED' },
          { amountDeltaCents: 5000n, status: 'APPROVED' },
        ],
      })
      const result = await calculatePriceEscalationSignals(client, 'job-1')
      expect(result).not.toBeNull()
      expect(result!.changeOrderCount).toBe(2)
      expect(result!.changeOrderValueCents).toBe(20000n)
      expect(result!.initialToFinalIncreaseBps).toBe(4000) // 40% increase = 4000 bps
    })

    it('returns null if no approved quote', async () => {
      const client = mockPrisma({
        job: { id: 'job-1', approvedQuoteId: null, customerId: 'c1' },
      })
      const result = await calculatePriceEscalationSignals(client, 'job-1')
      expect(result).toBeNull()
    })

    it('returns zero if no change orders', async () => {
      const client = mockPrisma({
        job: { id: 'job-1', customerId: 'customer-1', approvedQuoteId: 'quote-1', finalAuthorizedAmountCents: null },
      })
      const result = await calculatePriceEscalationSignals(client, 'job-1')
      expect(result).not.toBeNull()
      expect(result!.changeOrderCount).toBe(0)
      expect(result!.changeOrderValueCents).toBe(0n)
      expect(result!.initialToFinalIncreaseBps).toBe(0)
    })
  })

  describe('getCommercialHistory', () => {
    it('returns full commercial history', async () => {
      const client = mockPrisma({
        changeOrders: [
          {
            id: 'co-1',
            amountDeltaCents: 15000n,
            reason: 'Additional work',
            status: 'APPROVED',
            submittedAt: new Date('2026-09-11'),
            customerDecisionAt: new Date('2026-09-11'),
          },
        ],
      })
      const result = await getCommercialHistory(client, 'job-1')
      expect(result).not.toBeNull()
      expect(result!.initialQuote).not.toBeNull()
      expect(result!.approvedQuote).not.toBeNull()
      expect(result!.changeOrders).toHaveLength(1)
      expect(result!.finalAuthorizedAmountCents).toBe(70000n)
    })

    it('returns null if job not found', async () => {
      const client = mockPrisma()
      client.marketplaceJob.findUnique.mockResolvedValue(null)
      const result = await getCommercialHistory(client, 'nonexistent')
      expect(result).toBeNull()
    })

    it('handles job with no approved quote', async () => {
      const client = mockPrisma({
        job: { id: 'job-1', customerId: 'c1', approvedQuoteId: null, finalAuthorizedAmountCents: null },
        quote: null,
      })
      const result = await getCommercialHistory(client, 'job-1')
      expect(result).not.toBeNull()
      expect(result!.approvedQuote).toBeNull()
      expect(result!.finalAuthorizedAmountCents).toBeNull()
    })
  })
})
