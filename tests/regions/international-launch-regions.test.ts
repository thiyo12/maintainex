import { describe, expect, it } from 'vitest'
import { REGIONS } from '@/lib/regions'

describe('International launch: configured region choices', () => {
  it('retains all 25 Sri Lankan districts', () => {
    expect(REGIONS.LK.districts).toHaveLength(25)
    expect(REGIONS.LK.districts).toContain('Jaffna')
    expect(REGIONS.LK.districts).toContain('Colombo')
  })

  it('lists only Vancouver as a Canadian launch location', () => {
    expect(REGIONS.CA.districts).toEqual(['Vancouver'])
    expect(REGIONS.CA.currency).toBe('CAD')
    expect(REGIONS.LK.currency).toBe('LKR')
  })
})
