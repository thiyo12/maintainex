import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const source = readFileSync(
  resolve(process.cwd(), 'app/(admin)/admin/platform/website/page.tsx'),
  'utf-8',
)

describe('CRM website management error state', () => {
  it('fails closed when the canonical website overview cannot be loaded', () => {
    expect(source).toContain("if (!response.ok) throw crmApiError(body, 'Unable to load website operations')")
    expect(source).toContain('setOverview(null)')
    expect(source).toContain('if (!overview)')
    expect(source).toContain('Website operations unavailable')
    expect(source).toContain('onClick={load}')
  })

  it('never treats an API error body as a valid overview snapshot', () => {
    const throwIndex = source.indexOf("if (!response.ok) throw crmApiError(body, 'Unable to load website operations')")
    const setIndex = source.indexOf('setOverview(body)')
    expect(throwIndex).toBeGreaterThanOrEqual(0)
    expect(setIndex).toBeGreaterThan(throwIndex)
  })
})
