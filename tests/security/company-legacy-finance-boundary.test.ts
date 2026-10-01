import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('legacy company finance boundary', () => {
  it('does not activate a paid subscription without verified billing', () => {
    const route = read('app/api/mobile/company/subscription/route.ts')
    expect(route).toContain('Number(plan.price) > 0')
    expect(route).toContain("code: 'SUBSCRIPTION_BILLING_REQUIRED'")
    expect(route).toContain('{ status: 503 }')
  })

  it('serializes free subscription activation and exposes only an active subscription', () => {
    const route = read('app/api/mobile/company/subscription/route.ts')
    expect(route).toContain("subscriptions: {\n          where: { status: 'ACTIVE' }")
    expect(route).toContain('FOR UPDATE')
    expect(route).toContain("where: { companyId: profile.id, status: 'ACTIVE' }")
    expect(route).toContain("throw new Error('ACTIVE_SUBSCRIPTION_EXISTS')")
    expect(route).toContain("subscriptionStatus: 'CANCELLED'")
    expect(route).toContain('subscriptionExpiresAt: null')
  })

  it('uses the company payout identity for commission payment reads', () => {
    const route = read('app/api/mobile/company/earnings/route.ts')
    expect(route).toContain('select: { userId: true }')
    expect(route).toContain('providerId: company.userId')
    expect(route).not.toContain("providerId: user.id,\n        status: 'PENDING'")
  })
})
