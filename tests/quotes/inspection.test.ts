import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isValidInspectionTransition,
  isInspectionTerminal,
  createInspection,
  transitionInspection,
  completeInspection,
  scheduleInspection,
  type InspectionStatus,
} from '@/lib/domain/inspection'

function mockPrisma(overrides: Record<string, any> = {}) {
  return {
    marketplaceJob: {
      findUnique: vi.fn().mockResolvedValue(overrides.job ?? {
        id: 'job-1',
        customerId: 'customer-1',
        requiresInspection: true,
        status: 'OPEN',
      }),
    },
    jobInspection: {
      create: vi.fn().mockResolvedValue(overrides.inspection ?? { id: 'inspection-1', status: 'REQUESTED' }),
      findFirst: vi.fn().mockResolvedValue(overrides.existingInspection ?? null),
      findUnique: vi.fn().mockResolvedValue(overrides.foundInspection ?? null),
      update: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  } as any
}

describe('Phase 10.4 — Inspection Lifecycle', () => {
  describe('isValidInspectionTransition', () => {
    it('REQUESTED → SCHEDULED is valid', () => {
      expect(isValidInspectionTransition('REQUESTED', 'SCHEDULED')).toBe(true)
    })
    it('REQUESTED → CANCELLED is valid', () => {
      expect(isValidInspectionTransition('REQUESTED', 'CANCELLED')).toBe(true)
    })
    it('SCHEDULED → EN_ROUTE is valid', () => {
      expect(isValidInspectionTransition('SCHEDULED', 'EN_ROUTE')).toBe(true)
    })
    it('SCHEDULED → CANCELLED is valid', () => {
      expect(isValidInspectionTransition('SCHEDULED', 'CANCELLED')).toBe(true)
    })
    it('EN_ROUTE → ARRIVED is valid', () => {
      expect(isValidInspectionTransition('EN_ROUTE', 'ARRIVED')).toBe(true)
    })
    it('EN_ROUTE → NO_SHOW is valid', () => {
      expect(isValidInspectionTransition('EN_ROUTE', 'NO_SHOW')).toBe(true)
    })
    it('ARRIVED → IN_PROGRESS is valid', () => {
      expect(isValidInspectionTransition('ARRIVED', 'IN_PROGRESS')).toBe(true)
    })
    it('IN_PROGRESS → COMPLETED is valid', () => {
      expect(isValidInspectionTransition('IN_PROGRESS', 'COMPLETED')).toBe(true)
    })
    it('IN_PROGRESS → DISPUTED is valid', () => {
      expect(isValidInspectionTransition('IN_PROGRESS', 'DISPUTED')).toBe(true)
    })
    it('REQUESTED → COMPLETED is invalid (skipping states)', () => {
      expect(isValidInspectionTransition('REQUESTED', 'COMPLETED')).toBe(false)
    })
    it('COMPLETED → any is invalid (terminal)', () => {
      expect(isValidInspectionTransition('COMPLETED', 'REQUESTED')).toBe(false)
      expect(isValidInspectionTransition('COMPLETED', 'CANCELLED')).toBe(false)
    })
    it('CANCELLED → any is invalid (terminal)', () => {
      expect(isValidInspectionTransition('CANCELLED', 'SCHEDULED')).toBe(false)
    })
    it('NO_SHOW → any is invalid (terminal)', () => {
      expect(isValidInspectionTransition('NO_SHOW', 'EN_ROUTE')).toBe(false)
    })
    it('ARRIVED → CANCELLED is invalid', () => {
      expect(isValidInspectionTransition('ARRIVED', 'CANCELLED')).toBe(false)
    })
  })

  describe('isInspectionTerminal', () => {
    it('COMPLETED is terminal', () => {
      expect(isInspectionTerminal('COMPLETED')).toBe(true)
    })
    it('CANCELLED is terminal', () => {
      expect(isInspectionTerminal('CANCELLED')).toBe(true)
    })
    it('NO_SHOW is terminal', () => {
      expect(isInspectionTerminal('NO_SHOW')).toBe(true)
    })
    it('DISPUTED is terminal', () => {
      expect(isInspectionTerminal('DISPUTED')).toBe(true)
    })
    it('REQUESTED is not terminal', () => {
      expect(isInspectionTerminal('REQUESTED')).toBe(false)
    })
    it('IN_PROGRESS is not terminal', () => {
      expect(isInspectionTerminal('IN_PROGRESS')).toBe(false)
    })
  })

  describe('createInspection', () => {
    it('creates inspection for job requiring inspection', async () => {
      const client = mockPrisma()
      const result = await createInspection(client, {
        jobId: 'job-1',
        providerType: 'INDIVIDUAL',
        taskerId: 'provider-1',
      })
      expect(result.success).toBe(true)
      expect(result.inspectionId).toBe('inspection-1')
    })

    it('rejects if job not found', async () => {
      const client = mockPrisma()
      client.marketplaceJob.findUnique.mockResolvedValue(null)
      const result = await createInspection(client, {
        jobId: 'nonexistent',
        providerType: 'INDIVIDUAL',
        taskerId: 'provider-1',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Job not found')
    })

    it('rejects if job does not require inspection', async () => {
      const client = mockPrisma({ job: { id: 'job-2', requiresInspection: false, status: 'OPEN' } })
      const result = await createInspection(client, {
        jobId: 'job-2',
        providerType: 'INDIVIDUAL',
        taskerId: 'provider-1',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Job does not require inspection')
    })

    it('rejects if both taskerId and companyId specified', async () => {
      const client = mockPrisma()
      const result = await createInspection(client, {
        jobId: 'job-1',
        providerType: 'COMPANY',
        taskerId: 'provider-1',
        companyId: 'company-1',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Cannot specify both taskerId and companyId')
    })

    it('rejects if neither taskerId nor companyId specified', async () => {
      const client = mockPrisma()
      const result = await createInspection(client, {
        jobId: 'job-1',
        providerType: 'INDIVIDUAL',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Must specify either taskerId or companyId')
    })

    it('rejects if active inspection already exists', async () => {
      const client = mockPrisma({ existingInspection: { id: 'existing' } })
      const result = await createInspection(client, {
        jobId: 'job-1',
        providerType: 'INDIVIDUAL',
        taskerId: 'provider-1',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Job already has an active inspection')
    })
  })

  describe('scheduleInspection', () => {
    it('schedules inspection from REQUESTED', async () => {
      const client = mockPrisma({
        foundInspection: { id: 'inspection-1', status: 'REQUESTED', jobId: 'job-1' },
      })
      const result = await scheduleInspection(client, {
        inspectionId: 'inspection-1',
        userId: 'provider-1',
        scheduledAt: new Date('2026-09-15T10:00:00Z'),
      })
      expect(result.success).toBe(true)
      expect(client.jobInspection.update).toHaveBeenCalledWith({
        where: { id: 'inspection-1' },
        data: expect.objectContaining({
          status: 'SCHEDULED',
          scheduledAt: new Date('2026-09-15T10:00:00Z'),
        }),
      })
    })

    it('rejects if not REQUESTED', async () => {
      const client = mockPrisma({
        foundInspection: { id: 'inspection-1', status: 'SCHEDULED' },
      })
      const result = await scheduleInspection(client, {
        inspectionId: 'inspection-1',
        userId: 'provider-1',
        scheduledAt: new Date(),
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('must be REQUESTED')
    })
  })

  describe('transitionInspection', () => {
    it('transitions ARRIVED from EN_ROUTE', async () => {
      const client = mockPrisma({
        foundInspection: { id: 'inspection-1', status: 'EN_ROUTE', taskerId: 'provider-1' },
      })
      const result = await transitionInspection(client, {
        inspectionId: 'inspection-1',
        userId: 'provider-1',
        toStatus: 'ARRIVED',
      })
      expect(result.success).toBe(true)
    })

    it('rejects provider transition if not assigned', async () => {
      const client = mockPrisma({
        foundInspection: { id: 'inspection-1', status: 'EN_ROUTE', taskerId: 'provider-1', companyId: null, jobId: 'job-1' },
        job: { id: 'job-1', customerId: 'customer-1', requiresInspection: true },
      })
      const result = await transitionInspection(client, {
        inspectionId: 'inspection-1',
        userId: 'wrong-provider',
        toStatus: 'ARRIVED',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Not the assigned provider')
    })

    it('rejects from terminal status', async () => {
      const client = mockPrisma({
        foundInspection: { id: 'inspection-1', status: 'COMPLETED', taskerId: 'provider-1' },
      })
      const result = await transitionInspection(client, {
        inspectionId: 'inspection-1',
        userId: 'provider-1',
        toStatus: 'IN_PROGRESS',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('terminal status')
    })

    it('customer can cancel', async () => {
      const client = mockPrisma({
        foundInspection: { id: 'inspection-1', status: 'SCHEDULED', jobId: 'job-1' },
        job: { id: 'job-1', customerId: 'customer-1', requiresInspection: true },
      })
      const result = await transitionInspection(client, {
        inspectionId: 'inspection-1',
        userId: 'customer-1',
        toStatus: 'CANCELLED',
      })
      expect(result.success).toBe(true)
    })

    it('non-customer cannot cancel', async () => {
      const client = mockPrisma({
        foundInspection: { id: 'inspection-1', status: 'SCHEDULED', jobId: 'job-1' },
        job: { id: 'job-1', customerId: 'customer-1', requiresInspection: true },
      })
      const result = await transitionInspection(client, {
        inspectionId: 'inspection-1',
        userId: 'random-user',
        toStatus: 'CANCELLED',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Not the job customer')
    })

    it('rejects invalid transition', async () => {
      const client = mockPrisma({
        foundInspection: { id: 'inspection-1', status: 'REQUESTED', taskerId: 'provider-1' },
      })
      const result = await transitionInspection(client, {
        inspectionId: 'inspection-1',
        userId: 'provider-1',
        toStatus: 'COMPLETED',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid transition')
    })
  })

  describe('completeInspection', () => {
    it('completes inspection from IN_PROGRESS', async () => {
      const client = mockPrisma({
        foundInspection: { id: 'inspection-1', status: 'IN_PROGRESS', taskerId: 'provider-1' },
      })
      const result = await completeInspection(client, {
        inspectionId: 'inspection-1',
        providerId: 'provider-1',
        diagnosisSummary: 'Leaking pipe under sink',
        scopeSummary: 'Replace pipe, reseal cabinet',
      })
      expect(result.success).toBe(true)
      expect(client.jobInspection.update).toHaveBeenCalledWith({
        where: { id: 'inspection-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          diagnosisSummary: 'Leaking pipe under sink',
          scopeSummary: 'Replace pipe, reseal cabinet',
        }),
      })
    })

    it('rejects if not IN_PROGRESS', async () => {
      const client = mockPrisma({
        foundInspection: { id: 'inspection-1', status: 'SCHEDULED' },
      })
      const result = await completeInspection(client, {
        inspectionId: 'inspection-1',
        providerId: 'provider-1',
        diagnosisSummary: 'test',
        scopeSummary: 'test',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('must be IN_PROGRESS')
    })

    it('rejects if not the assigned provider', async () => {
      const client = mockPrisma({
        foundInspection: { id: 'inspection-1', status: 'IN_PROGRESS', taskerId: 'provider-1' },
      })
      const result = await completeInspection(client, {
        inspectionId: 'inspection-1',
        providerId: 'wrong-provider',
        diagnosisSummary: 'test',
        scopeSummary: 'test',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Not the assigned provider')
    })
  })
})
