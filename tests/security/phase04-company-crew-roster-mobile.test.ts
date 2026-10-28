import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Phase 04 — company crew management UI remains fail closed', () => {
  const source = readFileSync(resolve(process.cwd(),
    'apps/mobile/features/company/screens/tabs/dispatch.tsx'), 'utf8')

  it('loads only the signed-in company rosters while keeping legacy assignments', () => {
    expect(source).toContain('/api/mobile/company/crew/roster?companyId=')
    expect(source).toContain('/api/mobile/company/assignments?')
    expect(source).toContain('formingCrews.map(crew =>')
  })
  it('does not send actor credentials or worker IDs to cancellation', () => {
    expect(source).toContain('crewDispatchId: crew.id')
    expect(source).toContain('expectedVersion: crew.version')
    expect(source).toContain('companyId: activeCompanyId')
    expect(source).not.toContain('actorUserId:')
    expect(source).not.toContain('actorRole:')
  })
  it('requires destructive confirmation and never offers a crew work-start button', () => {
    expect(source).toContain('Cancel this unstarted crew?')
    expect(source).toContain("style: 'destructive'")
    expect(source).toContain('They do not authorize arrival')
    expect(source).toContain('Release staged crew')
  })
})
