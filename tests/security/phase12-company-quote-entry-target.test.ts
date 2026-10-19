import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('Phase 12 — company discovery must retain selected provider in quote request', () => {
  it('opens inline company details instead of swallowing company card taps', () => {
    const screen = read('apps/mobile/features/customer/screens/find/taskers/[jobId].tsx')
    expect(screen).toContain('setExpandedCompanyId(current => current === provider.id ? null : provider.id)')
    expect(screen).not.toContain("if (provider.providerType === 'COMPANY') return")
    expect(screen).toContain('Company request details')
    expect(screen).toContain('Tap card to view company details')
  })

  it('routes the selected company ID, not a broadcast request, into V2 creation', () => {
    const screen = read('apps/mobile/features/customer/screens/find/taskers/[jobId].tsx')
    expect(screen).toContain('onPress={() => postCompanyJob(item)}')
    expect(screen).toContain("provider.providerType !== 'COMPANY'")
    expect(screen).toContain('taskerId: provider.id')
    expect(screen).toContain('templateJobId: jobId')
    expect(screen).toContain("pathname: '/(customer)/jobs/v2/create'")
    expect(screen).not.toContain('style={styles.requestButton} onPress={postJob}')
  })

  it('preserves canonical V2 company market and eligibility checks at submit', () => {
    const screen = read('apps/mobile/features/jobs/screens/customer/v2/create.tsx')
    const route = read('app/api/mobile/v2/jobs/route.ts')
    expect(screen).toContain('targetTaskerId: params.taskerId || null')
    expect(route).toContain('targetTaskerId = company.id')
    expect(route).toContain('await checkCompanyEligibility(company.id)')
    expect(route).toContain('Target company country does not match the job country')
    expect(route).toContain('Target company lacks the required capability for this job')
  })
})
