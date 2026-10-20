import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Phase04 nonproduction crew stage UI requires two independent opt-ins', () => {
  const form = readFileSync(resolve(process.cwd(),
    'apps/mobile/features/company/screens/workforce/assign.tsx'), 'utf8')
  const server = readFileSync(resolve(process.cwd(),
    'app/api/mobile/company/crew/roster/route.ts'), 'utf8')

  it('gates every test reservation button to development and explicit mobile opt-in', () => {
    expect(form).toContain('const allowDevCrewStaging = __DEV__ &&')
    expect(form).toContain("process.env.EXPO_PUBLIC_MAINTAINEX_PHASE04_CREW_STAGING_UI === 'true'")
    expect(form).toContain('Stage internal test crew · no dispatch')
    expect(server).toContain("process.env.NODE_ENV === 'production'")
    expect(server).toContain("process.env.MAINTAINEX_PHASE04_CREW_STAGING_ENABLED !== 'true'")
  })

  it('requires an explicit lead, fully eligible preview and exact worker count', () => {
    expect(form).toContain('selectedCrewLead')
    expect(form).toContain('crewReadiness?.preflightReady')
    expect(form).toContain('selectedCrewWorkers.length !== selectedCrewJobData.workersCount')
    expect(form).toContain('selectedCrewWorkers.includes(selectedCrewLead)')
  })

  it('never grants PIN, work or payment authority when only test invitations are staged', () => {
    expect(form).toContain("'/api/mobile/company/crew/roster'")
    expect(form).toContain('leadWorkerUserId: selectedCrewLead')
    expect(form).toContain('Crew dispatch, arrival PIN, Start Work and payments remain disabled.')
    expect(form).not.toContain("'/api/mobile/company/crew/start'")
  })
})
