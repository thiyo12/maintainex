import { describe, expect, it, vi } from 'vitest'
import { resolveMarketplaceDisputeParticipant } from '@/lib/domain/marketplace-dispute-participants'

function dbFixture(options: {
  customerId?: string
  providerId?: string
  providerType?: string
  memberRole?: string | null
  assigned?: boolean
  activeMember?: boolean
} = {}) {
  const { customerId = 'customer-1', providerId = 'provider-1', providerType = 'INDIVIDUAL', memberRole = null, assigned = false, activeMember = false } = options
  return {
    marketplaceJob: { findUnique: vi.fn(async () => ({ id: 'job-1', customerId })) },
    jobQuote: { findFirst: vi.fn(async () => ({ providerId, providerType })) },
    teamMember: { findFirst: vi.fn(async () => activeMember ? { id: 'member-1', role: memberRole } : null) },
    companyJobAssignment: { findFirst: vi.fn(async () => assigned ? { id: 'assignment-1' } : null) },
  }
}

describe('current marketplace dispute participant authority', () => {
  it('accepts the customer and only the accepted individual provider', async () => {
    const db = dbFixture()
    await expect(resolveMarketplaceDisputeParticipant(db, 'job-1', 'customer-1')).resolves.toBe('CUSTOMER')
    await expect(resolveMarketplaceDisputeParticipant(db, 'job-1', 'provider-1')).resolves.toBe('PROVIDER')
    await expect(resolveMarketplaceDisputeParticipant(db, 'job-1', 'other-provider')).resolves.toBeNull()
  })

  it('accepts an active company manager or a currently assigned active worker', async () => {
    const managerDb = dbFixture({ providerType: 'COMPANY', memberRole: 'MANAGER', activeMember: true })
    await expect(resolveMarketplaceDisputeParticipant(managerDb, 'job-1', 'manager-1')).resolves.toBe('COMPANY')

    const workerDb = dbFixture({ providerType: 'COMPANY', memberRole: 'WORKER', activeMember: true, assigned: true })
    await expect(resolveMarketplaceDisputeParticipant(workerDb, 'job-1', 'worker-1')).resolves.toBe('COMPANY')
  })

  it('rejects unassigned staff, inactive members, and non-manager company roles', async () => {
    const unassignedDb = dbFixture({ providerType: 'COMPANY', memberRole: 'WORKER', activeMember: true })
    await expect(resolveMarketplaceDisputeParticipant(unassignedDb, 'job-1', 'worker-1')).resolves.toBeNull()

    const inactiveDb = dbFixture({ providerType: 'COMPANY', memberRole: 'MANAGER', activeMember: false, assigned: true })
    await expect(resolveMarketplaceDisputeParticipant(inactiveDb, 'job-1', 'removed-worker')).resolves.toBeNull()
  })
})
