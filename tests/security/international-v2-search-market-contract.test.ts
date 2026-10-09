import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const route = readFileSync(resolve(process.cwd(), 'app/api/mobile/v2/search/route.ts'), 'utf8')

describe('V2 search market eligibility source invariants', () => {
  it('loads only active categories and jobs', () => {
    expect(route).toContain('prisma.jobCategory.findMany')
    expect(route).toContain('prisma.templateJob.findMany')
    expect(route).toContain('where: { isActive: true')
  })

  it('filters both categories and jobs against their country lists', () => {
    expect(route).toContain('marketEnabled(c.countries)')
    expect(route).toContain('marketEnabled(j.countries)')
  })

  it('does not use unscoped search results directly in response lists', () => {
    expect(route).toContain('const eligibleResults = results.filter')
    expect(route).toContain("const categories = eligibleResults")
    expect(route).toContain("const subServices = eligibleResults")
  })

  it('partitions popular searches and new search logs by market', () => {
    expect(route).toContain('getPopularSearches(market)')
    expect(route).toContain('null, market)')
  })

  it('returns canonical template job identifiers', () => {
    expect(route).toContain('id: job.id')
  })
})
