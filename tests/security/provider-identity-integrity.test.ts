import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  hashStrongIdentityClaim,
  normalizeStrongIdentifier,
} from '@/lib/identity/identity-claims'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('provider identity integrity lifecycle', () => {
  const originalPepper = process.env.IDENTITY_CLAIM_PEPPER

  beforeEach(() => {
    process.env.IDENTITY_CLAIM_PEPPER = 'test-identity-claim-pepper-0123456789'
  })

  afterEach(() => {
    if (originalPepper === undefined) delete process.env.IDENTITY_CLAIM_PEPPER
    else process.env.IDENTITY_CLAIM_PEPPER = originalPepper
  })

  it('normalizes strong identifiers consistently', () => {
    expect(normalizeStrongIdentifier('  2001-234 567V ')).toBe('2001234567V')
    expect(normalizeStrongIdentifier('ab 12-34 cd')).toBe('AB1234CD')
  })

  it('creates deterministic claim hashes and separates claim types', () => {
    const first = hashStrongIdentityClaim('NATIONAL_ID_HASH', '2001-234 567V')
    const same = hashStrongIdentityClaim('NATIONAL_ID_HASH', '2001234567v')
    const passport = hashStrongIdentityClaim('PASSPORT_HASH', '2001234567v')

    expect(first).toBe(same)
    expect(first).not.toBe(passport)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
  })

  it('fails closed when the dedicated identity claim pepper is absent', () => {
    delete process.env.IDENTITY_CLAIM_PEPPER
    expect(() => hashStrongIdentityClaim('NATIONAL_ID_HASH', '2001234567V'))
      .toThrow('IDENTITY_CLAIM_PEPPER')
  })

  it('uses protected hashing for provider KYC duplicate matching', () => {
    const route = source('app/api/mobile/v2/identity/route.ts')
    const claims = source('lib/identity/identity-claims.ts')

    expect(route).toContain('recordStrongIdentityClaim')
    expect(claims).toContain("createHmac('sha256'")
    expect(claims).toContain('claimHash')
    expect(claims).toContain('IDENTITY_CLAIM_PEPPER')
  })

  it('blocks KYC approval until strong-identity risk is resolved', () => {
    const route = source('app/api/admin/kyc/route.ts')
    expect(route).toContain('IDENTITY_INTEGRITY_REVIEW_REQUIRED')
    expect(route).toContain('STRONG_IDENTITY_MATCH_WITH_FINANCIAL_LIABILITY')
    expect(route).toContain('STRONG_IDENTITY_REUSE')
    expect(route).toContain("status: { in: ['OPEN', 'REVIEWED', 'CONFIRMED'] }")
  })

  it('preserves provider debt and durable identity when account access closes', () => {
    const closure = source('lib/identity/account-closure.ts')

    expect(closure).toContain("'CLOSED_WITH_BALANCE'")
    expect(closure).toContain('commissionDue > 0n')
    expect(closure).toContain('adjustmentDue > 0n')
    expect(closure).toContain('ACCOUNT_CLOSURE_BLOCKED')
    expect(closure).toContain("'ACTIVE_JOBS'")
    expect(closure).toContain("'OPEN_DISPUTES'")
    expect(closure).toContain("'PENDING_PAYOUTS'")
    expect(closure).toContain("revokeReason: 'ACCOUNT_CLOSED'")
    expect(closure).not.toContain('providerIdentity.delete')
    expect(closure).not.toContain('providerFinancialAccount.delete')
  })

  it('prevents a closed verified account from silently re-registering', () => {
    const registration = source('app/api/mobile/auth/register/route.ts')
    expect(registration).toContain('ACCOUNT_CLOSED_REVIEW_REQUIRED')
    expect(registration).toContain('!existingPhone.isActive')
  })

  it('requires customer-confirmed worker identity before Start Work PIN', () => {
    const pin = source('lib/domain/job-pin.ts')
    const identityRoute = source('app/api/mobile/v2/jobs/[id]/worker-identity/route.ts')

    expect(pin).toContain("purpose === 'WORK_START' && job.workerIdentityCheckRequired")
    expect(pin).toContain("identityCheck.status !== 'MATCHED'")
    expect(pin).toContain('Customer must confirm the verified worker identity before work start')
    expect(identityRoute).toContain("'MISMATCH_REPORTED'")
    expect(identityRoute).toContain('CUSTOMER_WORKER_IDENTITY_MISMATCH')
  })

  it('gates Start Work PIN generation and rotation on the customer worker match', () => {
    const pin = source('lib/domain/job-pin.ts')
    const pinRoute = source('app/api/mobile/v2/jobs/[id]/pin/route.ts')
    const rotateRoute = source('app/api/mobile/v2/jobs/[id]/pin/rotate/route.ts')

    expect(pin).toContain('assertWorkerIdentityConfirmedBeforeWorkStartPin')
    expect(pin).toContain('Customer must confirm the verified worker identity before Start Work PIN')
    expect(pin).toContain('Worker identity mismatch requires Trust & Safety review before Start Work PIN')
    expect((pin.match(/assertWorkerIdentityConfirmedBeforeWorkStartPin\(prisma, jobId\)/g) || []).length)
      .toBeGreaterThanOrEqual(2)
    expect(pinRoute).toContain("error.message.includes('Start Work PIN')")
    expect(rotateRoute).toContain("error.message.includes('Start Work PIN')")
  })

  it('makes a customer-reported worker mismatch sticky until governed Trust & Safety dismissal', () => {
    const identityRoute = source('app/api/mobile/v2/jobs/[id]/worker-identity/route.ts')
    const integrityRoute = source('app/api/admin/trust-safety/integrity/route.ts')

    expect(identityRoute).toContain("existingCheck?.status === 'MISMATCH_REPORTED'")
    expect(identityRoute).toContain('WORKER_IDENTITY_MISMATCH_REVIEW_REQUIRED')
    expect(integrityRoute).toContain("signal.signalType === 'CUSTOMER_WORKER_IDENTITY_MISMATCH'")
    expect(integrityRoute).toContain("if (status === 'DISMISSED')")
    expect(integrityRoute).toContain('jobWorkerIdentityCheck.updateMany')
    expect(integrityRoute).toContain("status: 'MISMATCH_REPORTED'")
  })

  it('keeps verified public-photo changes behind governed CRM review', () => {
    const taskerProfile = source('app/api/mobile/taskers/profile/route.ts')
    const crmReview = source('app/api/admin/kyc/photo-changes/route.ts')

    expect(taskerProfile).toContain('VERIFIED_PHOTO_CHANGE_REQUIRES_REVIEW')
    expect(crmReview).toContain('providerPhotoChangeRequest')
    expect(crmReview).toContain('verifiedPhotoUrl: photoRequest.requestedPhotoUrl')
    expect(crmReview).toContain("riskLevel: 'HIGH'")
  })
})
