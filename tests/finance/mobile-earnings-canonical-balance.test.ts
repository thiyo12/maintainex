import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const source = readFileSync(
  resolve(process.cwd(), 'app/api/mobile/earnings/route.ts'),
  'utf-8',
)

describe('mobile earnings canonical finance reads', () => {
  it('reads available and pending money from the canonical provider wallet', () => {
    expect(source).toContain('const currency = getCurrencyForCountry(countryCode)')
    expect(source).toContain('readCanonicalProviderBalance(user.id, currency)')
    expect(source).toContain('canonicalBalance.availableBalance')
    expect(source).toContain('canonicalBalance.pendingBalance')
    expect(source).not.toContain('availableBalance: totalEarned - pendingAmount')
  })

  it('derives earned money from provider wallet escrow-release credits in the active market currency', () => {
    expect(source).toContain("accountType: 'PROVIDER_WALLET'")
    expect(source).toContain("entryType: 'CREDIT'")
    expect(source).toContain("referenceType: 'ESCROW_RELEASE'")
    expect(source).toContain('currency,')
    expect(source).not.toContain("currency: 'LKR'")
  })

  it('scopes payouts and legacy commission receivables to the provider market', () => {
    expect(source).toContain('where: { userId: user.id, countryCode, currency }')
    expect(source).toContain('providerId: user.id')
    expect(source).toContain('countryCode,')
    expect(source).toContain('currency,')
  })

  it('recognizes current payout reservation states', () => {
    expect(source).toContain("['REQUESTED', 'RESERVED', 'PROCESSING', 'PENDING']")
    expect(source).not.toContain(".filter(p => p.status === 'CLEARED')")
  })

  it('includes completed V2 individual-provider jobs', () => {
    expect(source).toContain('JOIN "JobQuote" jq ON jq."jobId" = mj.id')
    expect(source).toContain("jq.\"providerType\" = 'INDIVIDUAL'")
    expect(source).toContain("mj.status = 'COMPLETED'")
  })
})
