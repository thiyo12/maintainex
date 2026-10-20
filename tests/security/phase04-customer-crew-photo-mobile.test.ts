import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
describe('Phase04 — per-member customer photo decisions never enable crew work-start', () => {
  const panel = read('apps/mobile/features/jobs/components/CustomerCrewIdentityPanel.tsx')
  const detail = read('apps/mobile/features/jobs/screens/customer/v2/[id].tsx')

  it('confirms a selected worker and crew version only as authenticated customer', () => {
    expect(panel).toContain('crewDispatchId: crew.id')
    expect(panel).toContain('assignmentId: worker.assignmentId')
    expect(panel).toContain('expectedVersion: crew.version')
    expect(panel).toContain("decision,")
    expect(panel).not.toContain('customerUserId:')
  })

  it('requires destructive mismatch confirmation and keeps PIN disabled', () => {
    expect(panel).toContain('Report the wrong worker?')
    expect(panel).toContain("style: 'destructive'")
    expect(panel).toContain('Start Work PINs remain disabled')
    expect(detail).toContain('<CustomerCrewIdentityPanel jobId={job.id} />')
    expect(detail).toContain("(job.workersCount ?? 1) === 1")
  })
})
