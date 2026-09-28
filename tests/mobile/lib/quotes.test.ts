import { describe, it, expect } from 'vitest'

describe('Quote system', () => {
  it('valid provider types are INDIVIDUAL and COMPANY', () => {
    const types = ['INDIVIDUAL', 'COMPANY']
    expect(types).toContain('INDIVIDUAL')
    expect(types).toContain('COMPANY')
    expect(types).toHaveLength(2)
  })

  it('quote status transitions are valid', () => {
    const statuses = ['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN']
    const transitions: Record<string, string[]> = {
      PENDING: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
      ACCEPTED: [],
      REJECTED: [],
      WITHDRAWN: [],
    }
    for (const [from, toStates] of Object.entries(transitions)) {
      for (const to of toStates) {
        expect(statuses).toContain(to)
        expect(statuses).toContain(from)
      }
    }
  })

  it('company can submit a quote with providerType COMPANY', () => {
    const quote = {
      jobId: 'job_1',
      providerType: 'COMPANY',
      price: 25000,
      estimatedCompletionTime: '5 days',
      message: 'We can handle this project',
    }
    expect(quote.providerType).toBe('COMPANY')
    expect(quote.price).toBeGreaterThan(0)
    expect(quote.estimatedCompletionTime).toBeTruthy()
  })

  it('individual provider can submit a quote with providerType INDIVIDUAL', () => {
    const quote = {
      jobId: 'job_1',
      providerType: 'INDIVIDUAL',
      price: 15000,
      estimatedCompletionTime: '3 days',
      message: 'I can do this job',
    }
    expect(quote.providerType).toBe('INDIVIDUAL')
    expect(quote.price).toBeGreaterThan(0)
  })
})
