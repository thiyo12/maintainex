import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const source = readFileSync(
  resolve(process.cwd(), 'app/(admin)/admin/platform/website/page.tsx'),
  'utf-8',
)

describe('CRM website management error state', () => {
  it('does not render editable defaults after canonical settings fail to load', () => {
    expect(source).toContain('const [loadError, setLoadError]')
    expect(source).toContain('setOverview(null)')
    expect(source).toContain('if (loadError || !overview)')
    expect(source).toContain('Website management could not be loaded')
    expect(source).toContain('onClick={() => void load()}')
  })

  it('blocks save while the canonical settings snapshot is unavailable', () => {
    expect(source).toContain('if (!canEdit || loadError || !overview) return')
  })
})
