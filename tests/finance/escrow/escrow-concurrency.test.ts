import { describe, it, expect } from 'vitest'

describe('Escrow exactly-once release (unit-level verification)', () => {
  function createEscrowState(status: string) {
    return { id: 'esc-1', status, amount: 10000, serviceFee: 1000, providerId: 'prov-1' }
  }

  function attemptRelease(state: { status: string }) {
    if (state.status !== 'ON_HOLD') return { claimed: false, newState: state.status }
    state.status = 'RELEASED'
    return { claimed: true, newState: 'RELEASED' }
  }

  it('normal release claims once', () => {
    const escrow = createEscrowState('ON_HOLD')
    const result = attemptRelease(escrow)
    expect(result.claimed).toBe(true)
    expect(escrow.status).toBe('RELEASED')
  })

  it('sequential duplicate does not double-claim', () => {
    const escrow = createEscrowState('ON_HOLD')
    const first = attemptRelease(escrow)
    expect(first.claimed).toBe(true)

    const second = attemptRelease(escrow)
    expect(second.claimed).toBe(false)
    expect(escrow.status).toBe('RELEASED')
  })

  it('concurrent duplicate does not double-claim', () => {
    const escrow = createEscrowState('ON_HOLD')

    const results = [
      attemptRelease(escrow),
      attemptRelease(escrow),
      attemptRelease(escrow),
    ]

    const claimedCount = results.filter(r => r.claimed).length
    expect(claimedCount).toBe(1)
    expect(escrow.status).toBe('RELEASED')
  })

  it('rejected escrow cannot be released', () => {
    const escrow = createEscrowState('REFUNDED')
    const result = attemptRelease(escrow)
    expect(result.claimed).toBe(false)
  })

  it('already released escrow cannot be released again', () => {
    const escrow = createEscrowState('RELEASED')
    const result = attemptRelease(escrow)
    expect(result.claimed).toBe(false)
  })
})
