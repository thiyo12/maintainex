import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const route = readFileSync(resolve(process.cwd(), 'app/api/mobile/v2/pricing/estimate/route.ts'), 'utf8')

describe('International launch: preview pricing market safety', () => {
  it('only supports launch-country codes', () => {
    expect(route).toContain("market !== 'LK' && market !== 'CA'")
    expect(route).toContain("Unsupported pricing market")
  })
  it('requires active and eligible local service/category', () => {
    expect(route).toContain('isMarketEligible(category.countries)')
    expect(route).toContain('template.countryCode !== market')
    expect(route).toContain('template.currency !== expectedCurrency')
  })
  it('refuses Canadian category-level LKR seed estimates', () => {
    expect(route).toContain("else if (market === 'CA')")
    expect(route).toContain('A locally priced service is required for a Canadian estimate')
    expect(route).toContain("config?.defaultCurrency !== 'CAD'")
  })
  it('passes validated market to the existing canonical price engine', () => {
    expect(route).toContain('countryCode: market,')
    expect(route).toContain('calculatePrice(prisma')
  })
})
