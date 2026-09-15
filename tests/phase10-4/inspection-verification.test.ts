import { describe, it, expect, vi, beforeEach } from 'vitest'
import { verifyInspectionArrival, transitionInspection } from '@/lib/domain/inspection'

function mockPrisma(overrides: Record<string, any> = {}) {
  const hasInspection = 'inspection' in overrides
  return {
    jobInspection: {
      findUnique: vi.fn().mockResolvedValue(hasInspection ? overrides.inspection : {
        id: 'insp-1',
        status: 'ARRIVED',
        taskerId: 'provider-1',
        companyId: null,
        jobId: 'job-1',
        job: { customerId: 'customer-1' },
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    marketplaceJob: {
      findUnique: vi.fn().mockResolvedValue(overrides.job ?? {
        id: 'job-1',
        customerId: 'customer-1',
        requiresInspection: true,
        status: 'OPEN',
      }),
    },
    ...overrides,
  } as any
}

describe('Inspection arrival verification', () => {
  describe('verifyInspectionArrival', () => {
    it('verifies arrival for the job customer', async () => {
      const prisma = mockPrisma()
      const result = await verifyInspectionArrival(prisma, 'insp-1', 'customer-1')
      expect(result.success).toBe(true)
      expect(result.inspection).toBeDefined()
      expect(prisma.jobInspection.update).toHaveBeenCalledWith({
        where: { id: 'insp-1' },
        data: { verifiedByCustomer: true, verifiedAt: expect.any(Date) },
      })
    })

    it('rejects verification from non-customer', async () => {
      const prisma = mockPrisma({
        inspection: { id: 'insp-1', status: 'ARRIVED', taskerId: 'provider-1', companyId: null, jobId: 'job-1', job: { customerId: 'customer-1' } },
      })
      await expect(verifyInspectionArrival(prisma, 'insp-1', 'wrong-user'))
        .rejects.toThrow('NOT_CUSTOMER')
    })

    it('rejects verification when inspection not in ARRIVED status', async () => {
      const prisma = mockPrisma({
        inspection: { id: 'insp-1', status: 'IN_PROGRESS', taskerId: 'provider-1', companyId: null, jobId: 'job-1', job: { customerId: 'customer-1' } },
      })
      await expect(verifyInspectionArrival(prisma, 'insp-1', 'customer-1'))
        .rejects.toThrow('INVALID_STATUS')
    })

    it('rejects verification for non-existent inspection', async () => {
      const prisma = mockPrisma({ inspection: null })
      await expect(verifyInspectionArrival(prisma, 'nonexistent', 'customer-1'))
        .rejects.toThrow('NOT_FOUND')
    })
  })

  describe('Inspection transition resets verification', () => {
    it('resets verifiedByCustomer when arriving', async () => {
      const prisma = mockPrisma({
        inspection: {
          id: 'insp-1', status: 'EN_ROUTE', taskerId: 'provider-1', companyId: null, jobId: 'job-1',
        },
      })
      await transitionInspection(prisma, {
        inspectionId: 'insp-1',
        userId: 'provider-1',
        toStatus: 'ARRIVED',
      })
      expect(prisma.jobInspection.update).toHaveBeenCalledWith({
        where: { id: 'insp-1' },
        data: expect.objectContaining({
          verifiedByCustomer: false,
          verifiedAt: null,
        }),
      })
    })
  })
})
