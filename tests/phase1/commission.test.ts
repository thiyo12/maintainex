import { describe, it, expect } from 'vitest'

function computeCommission(escrowAmount: number, rate: number) {
  const clamped = Math.max(0, Math.min(100, rate))
  const commission = Math.round(escrowAmount * (clamped / 100) * 100) / 100
  return { commissionRate: clamped, commission, netAmount: escrowAmount - commission }
}

describe('Commission calculation', () => {
  it('0% commission returns full amount', () => {
    const result = computeCommission(10000, 0)
    expect(result.commission).toBe(0)
    expect(result.netAmount).toBe(10000)
    expect(result.commissionRate).toBe(0)
  })

  it('10% commission on 10000', () => {
    const result = computeCommission(10000, 10)
    expect(result.commission).toBe(1000)
    expect(result.netAmount).toBe(9000)
  })

  it('15% commission on 10000', () => {
    const result = computeCommission(10000, 15)
    expect(result.commission).toBe(1500)
    expect(result.netAmount).toBe(8500)
  })

  it('clamps rate above 100% to 100%', () => {
    const result = computeCommission(10000, 350)
    expect(result.commissionRate).toBe(100)
    expect(result.commission).toBe(10000)
    expect(result.netAmount).toBe(0)
  })

  it('clamps negative rate to 0%', () => {
    const result = computeCommission(10000, -5)
    expect(result.commissionRate).toBe(0)
    expect(result.commission).toBe(0)
    expect(result.netAmount).toBe(10000)
  })

  it('handles very small amount', () => {
    const result = computeCommission(100, 10)
    expect(result.commission).toBe(10)
    expect(result.netAmount).toBe(90)
  })

  it('handles large amount', () => {
    const result = computeCommission(1000000, 10)
    expect(result.commission).toBe(100000)
    expect(result.netAmount).toBe(900000)
  })

  it('commission never exceeds job amount', () => {
    const result = computeCommission(10000, 100)
    expect(result.commission).toBeLessThanOrEqual(10000)
    expect(result.netAmount).toBeGreaterThanOrEqual(0)
  })
})
