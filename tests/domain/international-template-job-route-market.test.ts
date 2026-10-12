import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const search = readFileSync(resolve(process.cwd(), 'app/api/mobile/template-jobs/search/route.ts'), 'utf8')
const listing = readFileSync(resolve(process.cwd(), 'app/api/mobile/template-jobs/route.ts'), 'utf8')

describe('legacy-consumer V2 template job country isolation', () => {
  for (const [name, source] of [['search', search], ['list', listing]] as const) {
    it(`${name} rejects unsupported markets`, () => {
      expect(source).toContain("market !== 'LK' && market !== 'CA'".replaceAll('market', name === 'list' ? 'country' : 'market'))
      expect(source).toContain("error: 'Unsupported market'")
    })
    it(`${name} checks both job and active parent category market grants`, () => {
      expect(source).toContain('j.category.isActive')
      expect(source).toContain('isCatalogAvailableInMarket(j.countries,')
      expect(source).toContain('isCatalogAvailableInMarket(j.category.countries,')
    })
  }
  it('caps search inputs and checks eligibility before returning the first 20 matches', () => {
    expect(search).toContain('query.length > 160')
    expect(search).toContain('eligible.slice(0, 20)')
  })
})
