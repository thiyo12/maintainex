import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const mobile = readFileSync(resolve(process.cwd(),
  'apps/mobile/features/company/screens/workforce/assign.tsx'), 'utf8')

describe('Phase 04 — crew preview cannot show a result for an obsolete roster', () => {
  it('invalidates pending reviews on job, roster and team refresh', () => {
    expect(mobile).toContain('const crewRequestVersion = useRef(0)')
    expect(mobile).toContain('const invalidateCrewReview = () => {')
    expect(mobile).toContain('const load = async () => {\\n    invalidateCrewReview()'.replace('\\n', '\n'))
    expect(mobile).toContain('const toggleCrewWorker = (workerUserId: string) => {\\n    invalidateCrewReview()'.replace('\\n', '\n'))
    expect(mobile).toContain('onPress={() => {\\n                  invalidateCrewReview()'.replace('\\n', '\n'))
  })

  it('only renders results and errors for the exact active request version', () => {
    expect(mobile).toContain('const requestedWorkers = [...selectedCrewWorkers]')
    expect(mobile).toContain('workerUserIds: requestedWorkers')
    expect(mobile).toContain('if (crewRequestVersion.current === requestVersion) setCrewReadiness(report)')
    expect(mobile).toContain('if (crewRequestVersion.current === requestVersion) setCheckingCrew(false)')
    expect(mobile).toContain('Crew dispatch and PINs remain disabled.')
  })
})
