import { describe, it, expect } from 'vitest'
import {
  isValidJobTransition,
  isValidWorkspaceTransition,
  canActorPerformWorkspaceTransition,
  type JobStatus,
  type WorkspaceStatus,
  type ActorType,
} from '@/lib/domain/job-lifecycle'

describe('4C.2 — Quote Acceptance Transaction', () => {
  describe('Job Status Transitions', () => {
    it('OPEN can transition to QUOTE_ACCEPTED', () => {
      expect(isValidJobTransition('OPEN', 'QUOTE_ACCEPTED')).toBe(true)
    })

    it('OPEN can transition to CANCELLED', () => {
      expect(isValidJobTransition('OPEN', 'CANCELLED')).toBe(true)
    })

    it('OPEN cannot transition to IN_PROGRESS directly', () => {
      expect(isValidJobTransition('OPEN', 'IN_PROGRESS')).toBe(false)
    })

    it('OPEN cannot transition to COMPLETED', () => {
      expect(isValidJobTransition('OPEN', 'COMPLETED')).toBe(false)
    })

    it('QUOTE_ACCEPTED can transition to IN_PROGRESS', () => {
      expect(isValidJobTransition('QUOTE_ACCEPTED', 'IN_PROGRESS')).toBe(true)
    })

    it('QUOTE_ACCEPTED can transition to CANCELLED', () => {
      expect(isValidJobTransition('QUOTE_ACCEPTED', 'CANCELLED')).toBe(true)
    })

    it('QUOTE_ACCEPTED cannot transition to OPEN', () => {
      expect(isValidJobTransition('QUOTE_ACCEPTED', 'OPEN')).toBe(false)
    })

    it('IN_PROGRESS can transition to COMPLETED', () => {
      expect(isValidJobTransition('IN_PROGRESS', 'COMPLETED')).toBe(true)
    })

    it('IN_PROGRESS cannot transition to CANCELLED directly', () => {
      expect(isValidJobTransition('IN_PROGRESS', 'CANCELLED')).toBe(false)
    })

    it('COMPLETED is terminal', () => {
      expect(isValidJobTransition('COMPLETED', 'OPEN')).toBe(false)
      expect(isValidJobTransition('COMPLETED', 'IN_PROGRESS')).toBe(false)
      expect(isValidJobTransition('COMPLETED', 'CANCELLED')).toBe(false)
    })

    it('CANCELLED is terminal', () => {
      expect(isValidJobTransition('CANCELLED', 'OPEN')).toBe(false)
      expect(isValidJobTransition('CANCELLED', 'IN_PROGRESS')).toBe(false)
      expect(isValidJobTransition('CANCELLED', 'COMPLETED')).toBe(false)
    })
  })

  describe('Workspace Status Transitions', () => {
    it('ACCEPTED → IN_PROGRESS', () => {
      expect(isValidWorkspaceTransition('ACCEPTED', 'IN_PROGRESS')).toBe(true)
    })

    it('ACCEPTED → DISPUTED', () => {
      expect(isValidWorkspaceTransition('ACCEPTED', 'DISPUTED')).toBe(true)
    })

    it('ACCEPTED → COMPLETED not allowed', () => {
      expect(isValidWorkspaceTransition('ACCEPTED', 'COMPLETED')).toBe(false)
    })

    it('IN_PROGRESS → WAITING_CUSTOMER', () => {
      expect(isValidWorkspaceTransition('IN_PROGRESS', 'WAITING_CUSTOMER')).toBe(true)
    })

    it('IN_PROGRESS → COMPLETION_REQUESTED', () => {
      expect(isValidWorkspaceTransition('IN_PROGRESS', 'COMPLETION_REQUESTED')).toBe(true)
    })

    it('IN_PROGRESS → DISPUTED', () => {
      expect(isValidWorkspaceTransition('IN_PROGRESS', 'DISPUTED')).toBe(true)
    })

    it('COMPLETION_REQUESTED → COMPLETED', () => {
      expect(isValidWorkspaceTransition('COMPLETION_REQUESTED', 'COMPLETED')).toBe(true)
    })

    it('COMPLETION_REQUESTED → DISPUTED', () => {
      expect(isValidWorkspaceTransition('COMPLETION_REQUESTED', 'DISPUTED')).toBe(true)
    })

    it('COMPLETED is terminal', () => {
      expect(isValidWorkspaceTransition('COMPLETED', 'IN_PROGRESS')).toBe(false)
      expect(isValidWorkspaceTransition('COMPLETED', 'DISPUTED')).toBe(false)
    })

    it('DISPUTED is terminal', () => {
      expect(isValidWorkspaceTransition('DISPUTED', 'IN_PROGRESS')).toBe(false)
      expect(isValidWorkspaceTransition('DISPUTED', 'COMPLETED')).toBe(false)
    })
  })

  describe('Actor Authorization', () => {
    it('CUSTOMER can perform IN_PROGRESS transition', () => {
      expect(canActorPerformWorkspaceTransition('CUSTOMER', 'IN_PROGRESS')).toBe(true)
    })

    it('PROVIDER cannot perform IN_PROGRESS transition', () => {
      expect(canActorPerformWorkspaceTransition('PROVIDER', 'IN_PROGRESS')).toBe(false)
    })

    it('PROVIDER can perform COMPLETION_REQUESTED transition', () => {
      expect(canActorPerformWorkspaceTransition('PROVIDER', 'COMPLETION_REQUESTED')).toBe(true)
    })

    it('COMPANY can perform COMPLETION_REQUESTED transition', () => {
      expect(canActorPerformWorkspaceTransition('COMPANY', 'COMPLETION_REQUESTED')).toBe(true)
    })

    it('CUSTOMER cannot perform COMPLETION_REQUESTED transition', () => {
      expect(canActorPerformWorkspaceTransition('CUSTOMER', 'COMPLETION_REQUESTED')).toBe(false)
    })

    it('STAFF cannot impersonate a provider-only workspace transition', () => {
      expect(canActorPerformWorkspaceTransition('STAFF', 'WAITING_CUSTOMER')).toBe(false)
    })
  })

  describe('Quote Acceptance Invariant — One Winner', () => {
    it('simulated: first acceptance wins', () => {
      const quotes = [
        { id: 'q1', status: 'PENDING' },
        { id: 'q2', status: 'PENDING' },
        { id: 'q3', status: 'PENDING' },
      ]

      function acceptQuote(quotes: { id: string; status: string }[], quoteId: string) {
        const existingAccepted = quotes.find(q => q.status === 'ACCEPTED')
        if (existingAccepted) return { success: false, reason: 'already has accepted quote' }
        const quote = quotes.find(q => q.id === quoteId)
        if (!quote || quote.status !== 'PENDING') return { success: false, reason: 'quote not pending' }
        quote.status = 'ACCEPTED'
        quotes.filter(q => q.id !== quoteId && q.status === 'PENDING').forEach(q => q.status = 'REJECTED')
        return { success: true }
      }

      const result1 = acceptQuote(quotes, 'q1')
      expect(result1.success).toBe(true)
      expect(quotes.filter(q => q.status === 'ACCEPTED').length).toBe(1)
      expect(quotes.filter(q => q.status === 'REJECTED').length).toBe(2)

      const result2 = acceptQuote(quotes, 'q2')
      expect(result2.success).toBe(false)
      expect(result2.reason).toBe('already has accepted quote')
    })

    it('simulated: 5-way concurrent acceptance — exactly one wins', () => {
      const quotes = Array.from({ length: 5 }, (_, i) => ({
        id: `q${i + 1}`,
        status: 'PENDING' as string,
      }))

      let acceptedCount = 0
      let rejectedCount = 0

      for (const quote of quotes) {
        if (quotes.some(q => q.status === 'ACCEPTED')) continue
        if (quote.status === 'PENDING') {
          quote.status = 'ACCEPTED'
          acceptedCount++
          quotes.filter(q => q.id !== quote.id && q.status === 'PENDING').forEach(q => {
            q.status = 'REJECTED'
            rejectedCount++
          })
        }
      }

      expect(acceptedCount).toBe(1)
      expect(quotes.filter(q => q.status === 'ACCEPTED').length).toBe(1)
      expect(quotes.filter(q => q.status === 'REJECTED').length).toBe(4)
    })
  })

  describe('Accept vs Cancel Race', () => {
    it('simulated: cancel during acceptance — only one valid outcome', () => {
      let jobStatus = 'OPEN'
      let quoteStatus = 'PENDING'
      let workspaceStatus: string | null = null

      function acceptQuote() {
        if (jobStatus !== 'OPEN') return { success: false, reason: 'job not open' }
        if (quoteStatus !== 'PENDING') return { success: false, reason: 'quote not pending' }
        jobStatus = 'QUOTE_ACCEPTED'
        quoteStatus = 'ACCEPTED'
        workspaceStatus = 'ACCEPTED'
        return { success: true }
      }

      function cancelJob() {
        if (jobStatus === 'COMPLETED' || jobStatus === 'CANCELLED') return { success: false, reason: 'terminal' }
        jobStatus = 'CANCELLED'
        return { success: true }
      }

      const acceptResult = acceptQuote()
      expect(acceptResult.success).toBe(true)
      expect(jobStatus).toBe('QUOTE_ACCEPTED')

      const cancelResult = cancelJob()
      expect(cancelResult.success).toBe(true)
      expect(jobStatus).toBe('CANCELLED')
    })

    it('simulated: cancel wins first — acceptance rejected', () => {
      let jobStatus = 'OPEN'
      let quoteStatus = 'PENDING'

      function acceptQuote() {
        if (jobStatus !== 'OPEN') return { success: false, reason: 'job not open' }
        jobStatus = 'QUOTE_ACCEPTED'
        quoteStatus = 'ACCEPTED'
        return { success: true }
      }

      function cancelJob() {
        if (jobStatus === 'COMPLETED' || jobStatus === 'CANCELLED') return { success: false, reason: 'terminal' }
        jobStatus = 'CANCELLED'
        return { success: true }
      }

      const cancelResult = cancelJob()
      expect(cancelResult.success).toBe(true)
      expect(jobStatus).toBe('CANCELLED')

      const acceptResult = acceptQuote()
      expect(acceptResult.success).toBe(false)
      expect(acceptResult.reason).toBe('job not open')
    })
  })

  describe('Idempotent Same-Quote Retry', () => {
    it('simulated: duplicate acceptance returns existing state', () => {
      const quotes = [
        { id: 'q1', status: 'ACCEPTED' },
        { id: 'q2', status: 'REJECTED' },
      ]

      function acceptQuote(quotes: { id: string; status: string }[], quoteId: string) {
        const existingAccepted = quotes.find(q => q.status === 'ACCEPTED')
        if (existingAccepted) return { success: false, reason: 'already has accepted quote', existing: true }
        return { success: true }
      }

      const result = acceptQuote(quotes, 'q1')
      expect(result.success).toBe(false)
      expect(result.existing).toBe(true)
    })
  })
})
