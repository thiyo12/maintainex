import { describe, expect, it } from 'vitest'
import { parseNonNegativeMajorUnitPrice } from '@/lib/shared/money/money'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Phase 05 — independent LKR/CAD price precision and market safeguards', () => {
  it('accepts exact major-unit amounts with at most two decimal places in both markets', () => {
    for (const currency of ['LKR', 'CAD'] as const) {
      expect(parseNonNegativeMajorUnitPrice(0, currency)).toBe(0)
      expect(parseNonNegativeMajorUnitPrice(15, currency)).toBe(15)
      expect(parseNonNegativeMajorUnitPrice('15.20', currency)).toBe(15.2)
      expect(parseNonNegativeMajorUnitPrice(99.99, currency)).toBe(99.99)
      expect(parseNonNegativeMajorUnitPrice('0.01', currency)).toBe(0.01)
    }
  })

  it('never rounds away sub-cent data for CAD or LKR', () => {
    for (const currency of ['LKR', 'CAD'] as const) {
      expect(parseNonNegativeMajorUnitPrice(1.001, currency)).toBeNull()
      expect(parseNonNegativeMajorUnitPrice('3.999', currency)).toBeNull()
      expect(parseNonNegativeMajorUnitPrice('0.001', currency)).toBeNull()
    }
  })

  it('blocks negative, nonfinite, exponential, whitespace-only and formatted input', () => {
    for (const bad of [-1, NaN, Infinity, -Infinity, '1e5', '-4', '', ' ', '1,000', '$12', 'Rs 45', null, {}, true]) {
      expect(parseNonNegativeMajorUnitPrice(bad, 'CAD')).toBeNull()
    }
  })

  it('refuses values whose minor units cannot safely fit a JS integer', () => {
    expect(parseNonNegativeMajorUnitPrice('90071992547409.92', 'LKR')).toBeNull()
    expect(parseNonNegativeMajorUnitPrice('999999999999999999', 'CAD')).toBeNull()
  })

  it('returns the entered price without applying CAD to LKR currency conversion', () => {
    expect(parseNonNegativeMajorUnitPrice('100.50', 'CAD')).toBe(100.5)
    expect(parseNonNegativeMajorUnitPrice('100.50', 'LKR')).toBe(100.5)
  })

  it('fails closed on unsupported currency even if the call site is mistyped', () => {
    expect(parseNonNegativeMajorUnitPrice(100, 'USD' as 'LKR')).toBeNull()
  })

  it('checks provider rates before mutating capability selections', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/api/mobile/taskers/skills/route.ts'), 'utf8')
    const validate = source.indexOf('parseNonNegativeMajorUnitPrice(value, getCurrencyForCountry(market))')
    const mutation = source.indexOf('await prisma.taskerSkill.deleteMany')
    expect(validate).toBeGreaterThan(-1)
    expect(mutation).toBeGreaterThan(validate)
  })

  it('stores precisely validated provider major-unit prices in both mutation paths', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/api/mobile/taskers/skills/route.ts'), 'utf8')
    expect(source).toContain('parseNonNegativeMajorUnitPrice(s.hourlyRate')
    expect(source).toContain('parseNonNegativeMajorUnitPrice(s.fixedRate')
    expect(source).toContain('currency: getCurrencyForCountry(market)')
  })

  it('creates V2 catalogue items inactive by default even without publish permission', () => {
    const route = readFileSync(resolve(process.cwd(), 'app/api/admin/platform/catalog/route.ts'), 'utf8')
    expect(route).toContain("const requestedActive = (type === 'jobCategory' || type === 'templateJob')")
    expect(route).toContain("? body?.isActive === true")
    expect(route).toContain('const isActive = publishAllowed && explicitlyActive')
  })

  it('enforces currency-market pairing without FX conversion for CRM V2', () => {
    const route = readFileSync(resolve(process.cwd(), 'app/api/admin/platform/catalog/route.ts'), 'utf8')
    expect(route).toContain("const MARKET_CURRENCY: Record<string, string> = { LK: 'LKR', CA: 'CAD' }")
    expect(route).toContain('const priceMin = parseNonNegativeMajorUnitPrice(')
    expect(route).toContain('const priceMax = parseNonNegativeMajorUnitPrice(')
    expect(route).not.toContain('const priceMin = Number(body?.priceMin ?? 0)')
  })
})
