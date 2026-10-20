import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Phase04 — tasker crew invitation screen does not grant work', () => {
  const screen = readFileSync(resolve(process.cwd(),
    'apps/mobile/features/tasker/screens/company-assignments.tsx'), 'utf8')

  it('fetches worker-only invitations without bypassing legacy assignments', () => {
    expect(screen).toContain("'/api/mobile/worker/crew'")
    expect(screen).toContain('/api/mobile/worker/assignments?companyId=')
    expect(screen).toContain("invitation.crew?.status === 'FORMING'")
    expect(screen).toContain('dispatchEnabled: false')
  })

  it('accept/reject requests use version token without client-selected worker identity', () => {
    expect(screen).toContain('crewDispatchId: invitation.crew.id')
    expect(screen).toContain('expectedVersion: invitation.crew.version')
    expect(screen).toContain('action,')
    expect(screen).not.toContain('workerUserId: invitation')
    expect(screen).toContain("action === 'accept'")
  })

  it('requires destructive decline confirmation and warns work-start is blocked', () => {
    expect(screen).toContain('Decline this crew?')
    expect(screen).toContain("style: 'destructive'")
    expect(screen).toContain('Dispatch not enabled')
    expect(screen).toContain('no crew member may start work')
  })
})
