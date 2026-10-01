import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const source = readFileSync(
  resolve(process.cwd(), 'lib/finance/payments/payment-service.ts'),
  'utf-8',
)

describe('PayHere refund concurrency contract', () => {
  it('claims REFUND_REQUIRED before calling the external refund API', () => {
    const fnStart = source.indexOf('export async function requestRequiredPayHereRefund')
    const reconcileStart = source.indexOf('export async function reconcilePayHereRefund')
    const fn = source.slice(fnStart, reconcileStart)

    const claimIndex = fn.indexOf('const requestClaimed = await prisma.paymentIntent.updateMany')
    const externalIndex = fn.indexOf('const refund = await requestPayHereRefund')

    expect(claimIndex).toBeGreaterThan(-1)
    expect(externalIndex).toBeGreaterThan(claimIndex)
    expect(fn).toContain("status: 'REFUND_REQUIRED'")
    expect(fn).toContain("status: 'REFUND_PROCESSING'")
    expect(fn).toContain('if (requestClaimed.count !== 1)')
    expect(fn).toContain('return reconcilePayHereRefund(paymentIntentId)')
  })

  it('returns a failed external request to the retryable refund queue', () => {
    const fnStart = source.indexOf('export async function requestRequiredPayHereRefund')
    const reconcileStart = source.indexOf('export async function reconcilePayHereRefund')
    const fn = source.slice(fnStart, reconcileStart)

    expect(fn).toContain("where: { id: intent.id, status: 'REFUND_PROCESSING' }")
    expect(fn).toContain("status: 'REFUND_REQUIRED'")
    expect(fn).toContain("gatewayStatus: 'REFUND REQUEST FAILED'")
  })

  it('does not place the external refund call before the database claim', () => {
    const externalCall = 'const refund = await requestPayHereRefund'
    const claimPattern = 'const requestClaimed = await prisma.paymentIntent.updateMany'

    expect(source.indexOf(claimPattern)).toBeGreaterThan(-1)
    expect(source.indexOf(externalCall)).toBeGreaterThan(-1)
    expect(source.indexOf(claimPattern)).toBeLessThan(source.indexOf(externalCall))
  })
})
