import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}
describe('Phase04 crew may not be charged before dispatch/pin/start are fully supported', () => {
  it('checks explicit worker count at both preview and locked online intent creation', () => {
    const s = source('lib/finance/payments/payment-service.ts')
    expect(s).toContain("code: 'CREW_PAYMENT_NOT_ENABLED'")
    expect(s).toContain("SELECT id, \"customerId\", status, title, \"workersCount\"")
    expect(s).toContain('(job.workersCount ?? 1) !== 1')
    expect(s).toContain('(previewJob.workersCount ?? 1) !== 1')
  })
  it('blocks new wallet escrow debit and cash while preserving cash idempotency', () => {
    const s = source('lib/finance/escrow/escrow-service.ts')
    expect(s).toContain("if ((job.workersCount ?? 1) !== 1) throw new Error('CREW_PAYMENT_NOT_ENABLED')")
    expect(s).toContain("if ((lockedJob.workersCount ?? 1) !== 1) throw new Error('CREW_PAYMENT_NOT_ENABLED')")
    expect(s.indexOf("if (escrow.paymentMethod === 'CASH' && escrow.status === 'CASH_CONFIRMED')"))
      .toBeLessThan(s.indexOf("if ((lockedJob.workersCount ?? 1) !== 1)"))
    expect(s).toContain("status: 'PROTECTED'")
  })
  it('does not present unsupported checkout or hide prior transactions', () => {
    const api = source('app/api/mobile/v2/jobs/[id]/payment/route.ts')
    const screen = source('apps/mobile/features/jobs/screens/customer/v2/[id].tsx')
    expect(api).toContain("market: { valid: false, code: 'CREW_PAYMENT_NOT_ENABLED'")
    expect(api).toContain('payment,')
    expect(api).toContain('options: null')
    expect(screen).toContain("(job.workersCount ?? 1) === 1")
  })
  it('keeps refunds, historical settlement, and finance permissions untouched', () => {
    expect(source('app/api/mobile/v2/jobs/[id]/cash-payment/route.ts'))
      .toContain("if (message === 'CREW_PAYMENT_NOT_ENABLED')")
    expect(source('app/api/mobile/v2/jobs/[id]/escrow/route.ts'))
      .toContain("message.includes('CREW_PAYMENT_NOT_ENABLED')")
  })
})
