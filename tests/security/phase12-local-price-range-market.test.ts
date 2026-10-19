import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript'

// This Vitest job deliberately installs no Expo runtime. Compile and execute
// the same dependency-free mobile helper in memory to test its actual logic.
const helper = readFileSync(resolve(process.cwd(),
  'apps/mobile/lib/provider-discovery-display.ts'), 'utf8')
const js = transpileModule(helper, {
  compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2020 },
}).outputText
const sandbox = { exports: {} as Record<string, (...args: any[]) => any> }
runInNewContext(js, sandbox, { timeout: 1000 })
const range = sandbox.exports.verifiedLocalPriceRange

describe('Phase 12 — V2 local range cannot borrow unsupported currency', () => {
  it('uses only engine estimates explicitly priced in the selected market', () => {
    expect(range({ currency: 'CAD', priceRange: { min: 50, max: 130 } }, [], 'CA'))
      .toMatchObject({ min: 50, max: 130, currency: 'CAD', source: 'ENGINE' })
    expect(range({ currency: 'LKR', priceRange: { min: 1400, max: 3400 } }, [], 'CA'))
      .toBeNull()
  })

  it('ignores LK templates when the request is in Vancouver and vice versa', () => {
    const services = [
      { currency: 'LKR', priceMin: 900, priceMax: 5000 },
      { currency: 'CAD', priceMin: 60, priceMax: 120 },
      { currency: 'CAD', priceMin: 80, priceMax: 180 },
    ]
    expect(range(null, services, 'CA')).toMatchObject({
      min: 60, max: 180, currency: 'CAD', source: 'CATALOGUE',
    })
    expect(range(null, services, 'LK')).toMatchObject({
      min: 900, max: 5000, currency: 'LKR', source: 'CATALOGUE',
    })
  })

  it('never assumes LKR/CAD for untagged or ill-formed template amounts', () => {
    const wrong = [
      { priceMin: 150, priceMax: 400 },
      { currency: 'CAD', priceMin: 'oops', priceMax: 250 },
      { currency: 'CAD', priceMin: -10, priceMax: 250 },
      { currency: 'CAD', priceMin: 500, priceMax: 20 },
    ]
    expect(range({ priceRange: { min: 10, max: 100 } }, wrong, 'CA')).toBeNull()
    expect(range(null, wrong, 'XX')).toBeNull()
  })

  it('falls back from stale estimate only to valid same-market catalogue entries', () => {
    expect(range({ currency: 'LKR', priceRange: { min: 800, max: 1800 } },
      [{ currency: 'CAD', priceMin: 60, priceMax: 150 }], 'CA')).toMatchObject({
      min: 60, max: 150, currency: 'CAD', source: 'CATALOGUE',
    })
  })

  it('wires V2 form to verified range and hides AI label for catalogue-only data', () => {
    const screen = readFileSync(resolve(process.cwd(),
      'apps/mobile/features/jobs/screens/customer/v2/create.tsx'), 'utf8')
    expect(screen).toContain('verifiedLocalPriceRange(estimate, (selectedCategory as any)?.jobs, countryCode)')
    expect(screen).toContain("localRange?.source === 'ENGINE'")
    expect(screen).toContain('Quote required — no verified local range')
    expect(screen).not.toContain("currency: estimate.currency || 'LKR'")
    expect(screen).not.toContain("currency: jobs[0]?.currency || 'LKR'")
  })
})
