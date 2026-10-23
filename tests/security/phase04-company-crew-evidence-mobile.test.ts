import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Phase04 company crew evidence review is not a work-start action', () => {
  const source = readFileSync(resolve(process.cwd(),
    'apps/mobile/features/company/screens/tabs/dispatch.tsx'), 'utf8')
  it('binds evidence to the selected company and crew version, not client actor claims', () => {
    expect(source).toContain("'/api/mobile/company/crew/evidence'")
    expect(source).toContain('crewDispatchId: crew.id')
    expect(source).toContain('expectedVersion: crew.version')
    expect(source).toContain('companyId: activeCompanyId')
    expect(source).not.toContain('actorUserId: ')
  })
  it('makes explicit that all-worker verification is not work authorization', () => {
    expect(source).toContain('Check all worker identities')
    expect(source).toContain('Crew dispatch, arrival and Start Work remain disabled.')
    expect(source).toContain('Crew identity checks are incomplete')
  })
})
