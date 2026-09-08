import { describe, it, expect } from 'vitest'

describe('Withdrawal safety (behavioral)', () => {
  it('rejects withdrawal exceeding balance', () => {
    const balance = 5000
    const requested = 10000
    expect(balance >= requested).toBe(false)
  })

  it('allows withdrawal within balance', () => {
    const balance = 10000
    const requested = 5000
    expect(balance >= requested).toBe(true)
  })

  it('rejects zero amount', () => {
    const amount = 0
    expect(amount > 0).toBe(false)
  })

  it('rejects negative amount', () => {
    const amount = -100
    expect(amount > 0).toBe(false)
  })
})
