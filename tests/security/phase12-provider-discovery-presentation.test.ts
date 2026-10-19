import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript'

// This isolated server-side Vitest job installs only the root dependencies.
// Importing a mobile .ts file directly asks Vite to resolve Expo's tsconfig
// without Expo installed. Execute the exact pure helper through TypeScript's
// standard in-memory transpilation rather than testing a duplicate function.
const original = readFileSync(resolve(process.cwd(),
  'apps/mobile/lib/provider-discovery-display.ts'), 'utf8')
const compiled = transpileModule(original, {
  compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2020 },
}).outputText
const sandbox = { exports: {} as Record<string, (...args: any[]) => string> }
runInNewContext(compiled, sandbox, { timeout: 1000 })
const { directRequestPriceGuide, providerDistanceLabel, providerPriceGuide } = sandbox.exports

describe('Phase 12 market-aware public provider price/availability hints', () => {
  it('preserves historical LKR-only provider-rate hints without currency conversion', () => {
    expect(providerPriceGuide({ hourlyRate: 1400 }, null, 'LK')).toBe(
      'Indicative from LKR 1,400 · confirm quote',
    )
    expect(providerPriceGuide({ hourlyRate: 1400 }, null, 'CA')).toBe('Quote required')
  })

  it('requires explicit CAD provenance before showing a Canadian price', () => {
    expect(providerPriceGuide({ hourlyRate: 75, currency: 'CAD' }, null, 'CA'))
      .toBe('Indicative from CAD 75 · confirm quote')
    expect(providerPriceGuide({ hourlyRate: 1400, currency: 'LKR' }, null, 'CA'))
      .toBe('Quote required')
    expect(providerPriceGuide({ hourlyRate: 1400, currency: 'CAD' }, null, 'LK'))
      .toBe('Quote required')
  })

  it('uses the actual service currency for guides and refuses cross-market fallback', () => {
    const canada = { priceMin: 100, priceMax: 200, currency: 'CAD' }
    expect(providerPriceGuide({}, canada, 'CA')).toBe('Service guide from CAD 100 · confirm quote')
    expect(providerPriceGuide({}, canada, 'LK')).toBe('Quote required')
    expect(directRequestPriceGuide({}, canada, 'CA')).toBe(
      'Service guide CAD 100–CAD 200 · confirm quote',
    )
    expect(directRequestPriceGuide({}, { ...canada, currency: 'LKR' }, 'CA')).toBe('Quote required')
  })

  it('never shows fake prices for null, unknown, corrupted or zero values', () => {
    expect(providerPriceGuide({ startingPrice: null, hourlyRate: 0 }, null, 'CA')).toBe('Quote required')
    expect(providerPriceGuide({ hourlyRate: Number.POSITIVE_INFINITY }, null, 'LK')).toBe('Quote required')
    expect(providerPriceGuide({ hourlyRate: 'abc' }, null, undefined)).toBe('Quote required')
  })

  it('does not turn deliberately hidden/null GPS distances into 1 metre away', () => {
    expect(providerDistanceLabel({ distance: null })).toBe('Distance not shown')
    expect(providerDistanceLabel({ distanceKm: undefined })).toBe('Distance not shown')
    expect(providerDistanceLabel({ distance: 0 })).toBe('Distance not shown')
    expect(providerDistanceLabel({ distance: 1.23 })).toBe('1.2 km away')
    expect(providerDistanceLabel({ distanceKm: 0.6 })).toBe('600 m away')
  })

  it('wires all three provider screens to the shared price policy', () => {
    const files = [
      'apps/mobile/features/customer/screens/find/taskers/[jobId].tsx',
      'apps/mobile/features/customer/screens/find/tasker-profile/[taskerId].tsx',
      'apps/mobile/features/customer/screens/find/booking/[jobId].tsx',
    ]
    for (const path of files) {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8')
      expect(source).toContain('selectedCountry?.code')
      expect(source).not.toContain('From LKR')
      expect(source).not.toContain('Available now')
    }
    const create = readFileSync(resolve(process.cwd(),
      'apps/mobile/features/jobs/screens/customer/v2/create.tsx'), 'utf8')
    expect(create).toContain("countryCode === 'CA' ? 'CAD amount' : 'LKR amount'")
  })
})
