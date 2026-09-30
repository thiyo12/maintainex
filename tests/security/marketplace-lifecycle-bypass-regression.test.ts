import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const lifecycle = readFileSync(resolve(process.cwd(), 'lib/domain/job-lifecycle.ts'), 'utf-8')
const workspaceRoute = readFileSync(
  resolve(process.cwd(), 'app/api/mobile/v2/jobs/[id]/workspace/route.ts'),
  'utf-8'
)
const pin = readFileSync(resolve(process.cwd(), 'lib/domain/job-pin.ts'), 'utf-8')
const escrow = readFileSync(resolve(process.cwd(), 'lib/finance/escrow/escrow-service.ts'), 'utf-8')

describe('marketplace lifecycle bypass regressions', () => {
  it('keeps PIN verification as the only ACCEPTED -> IN_PROGRESS work-start path', () => {
    expect(lifecycle).toContain("targetStatus === 'IN_PROGRESS' && workspace.progressStatus === 'ACCEPTED'")
    expect(lifecycle).toContain('Work start requires PIN verification')
    expect(pin).toContain("where: { id: jobId, status: 'QUOTE_ACCEPTED' }")
    expect(pin).toContain("data: { status: 'IN_PROGRESS' }")
  })

  it('does not allow the generic workspace endpoint to complete or dispute a job', () => {
    expect(workspaceRoute).toContain("const validStatuses: WorkspaceStatus[] = ['IN_PROGRESS', 'WAITING_CUSTOMER']")
    expect(workspaceRoute).not.toContain("'COMPLETED', 'DISPUTED'")
    expect(lifecycle).toContain('Completion must use the escrow release flow')
    expect(lifecycle).toContain('Disputes must use the canonical dispute flow')
  })

  it('makes WAITING_CUSTOMER provider-only and resume customer-only', () => {
    expect(lifecycle).toContain("const PROVIDER_ONLY_WORKSPACE: WorkspaceStatus[] = ['WAITING_CUSTOMER', 'COMPLETION_REQUESTED']")
    expect(workspaceRoute).toContain("progressStatus === 'WAITING_CUSTOMER' && actorType === 'CUSTOMER'")
    expect(workspaceRoute).toContain("progressStatus === 'IN_PROGRESS' && actorType !== 'CUSTOMER'")
  })

  it('keeps completion coupled to protected escrow release', () => {
    expect(escrow).toContain("workspace.progressStatus !== 'COMPLETION_REQUESTED'")
    expect(escrow).toContain("data: { status: 'RELEASED', releasedAt: new Date() }")
    expect(escrow).toContain("data: { status: 'COMPLETED', updatedAt: new Date() }")
  })
})
