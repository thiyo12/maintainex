import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the notifications service module
vi.mock('@/lib/notifications/notification-service', () => ({
  createNotification: vi.fn().mockResolvedValue({ id: 'notif-1' }),
}))

import { createNotification } from '@/lib/notifications'
import {
  notifyInspectionRequested,
  notifyInspectionArrived,
  notifyInspectionCompleted,
  notifyChangeOrderSubmitted,
  notifyChangeOrderApproved,
  notifyChangeOrderRejected,
  notifyRiskEventDetected,
} from '@/lib/notifications-phase10-4'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Phase 10.4 notifications', () => {
  describe('notifyInspectionRequested', () => {
    it('sends notifications to both provider and customer', async () => {
      await notifyInspectionRequested('job-1', 'customer-1', 'provider-1', 'Fix sink')
      expect(createNotification).toHaveBeenCalledTimes(2)

      const calls = (createNotification as any).mock.calls
      const userIds = calls.map((c: any[]) => c[0].userId).sort()
      expect(userIds).toEqual(['customer-1', 'provider-1'])
    })

    it('includes correct referenceType and referenceId', async () => {
      await notifyInspectionRequested('job-1', 'customer-1', 'provider-1', 'Fix sink')
      const calls = (createNotification as any).mock.calls
      for (const call of calls) {
        expect(call[0].referenceType).toBe('JOB')
        expect(call[0].referenceId).toBe('job-1')
      }
    })
  })

  describe('notifyInspectionArrived', () => {
    it('notifies customer only', async () => {
      await notifyInspectionArrived('job-1', 'customer-1', 'John', 'Fix sink')
      expect(createNotification).toHaveBeenCalledTimes(1)
      expect((createNotification as any).mock.calls[0][0].userId).toBe('customer-1')
    })

    it('includes provider name in body', async () => {
      await notifyInspectionArrived('job-1', 'customer-1', 'John', 'Fix sink')
      const body = (createNotification as any).mock.calls[0][0].body
      expect(body).toContain('John')
    })
  })

  describe('notifyInspectionCompleted', () => {
    it('notifies customer only', async () => {
      await notifyInspectionCompleted('job-1', 'customer-1', 'John', 'Fix sink')
      expect(createNotification).toHaveBeenCalledTimes(1)
      expect((createNotification as any).mock.calls[0][0].userId).toBe('customer-1')
    })
  })

  describe('notifyChangeOrderSubmitted', () => {
    it('notifies customer with change order number', async () => {
      await notifyChangeOrderSubmitted('job-1', 'customer-1', 'John', 'Fix sink', 2)
      expect(createNotification).toHaveBeenCalledTimes(1)
      const params = (createNotification as any).mock.calls[0][0].params
      expect(params.changeOrderNumber).toBe('2')
    })
  })

  describe('notifyChangeOrderApproved', () => {
    it('notifies provider', async () => {
      await notifyChangeOrderApproved('job-1', 'provider-1', 'Fix sink', 1)
      expect(createNotification).toHaveBeenCalledTimes(1)
      expect((createNotification as any).mock.calls[0][0].userId).toBe('provider-1')
    })
  })

  describe('notifyChangeOrderRejected', () => {
    it('notifies provider', async () => {
      await notifyChangeOrderRejected('job-1', 'provider-1', 'Fix sink', 1)
      expect(createNotification).toHaveBeenCalledTimes(1)
      expect((createNotification as any).mock.calls[0][0].userId).toBe('provider-1')
    })
  })

  describe('notifyRiskEventDetected', () => {
    it('notifies admin', async () => {
      await notifyRiskEventDetected('job-1', 'CONTACT_SHARING', 'Fix sink', 'admin-1')
      expect(createNotification).toHaveBeenCalledTimes(1)
      expect((createNotification as any).mock.calls[0][0].userId).toBe('admin-1')
    })

    it('includes event type in params', async () => {
      await notifyRiskEventDetected('job-1', 'CONTACT_SHARING', 'Fix sink', 'admin-1')
      const params = (createNotification as any).mock.calls[0][0].params
      expect(params.eventType).toBe('CONTACT_SHARING')
    })
  })
})
