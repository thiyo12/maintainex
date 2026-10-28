import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertTrustedBankEvidenceSource } from '@/lib/finance/commissions/bank-credit-reconciliation'

afterEach(() => {
  vi.unstubAllEnvs()
})

const statement = (overrides: Partial<Parameters<typeof assertTrustedBankEvidenceSource>[0]> = {}) => ({
  provenanceStatus: 'VERIFIED',
  provenanceType: 'BANK_FEED',
  sourceSystem: 'approved-bank-feed',
  verificationSource: 'approved-bank-feed',
  verificationRef: 'synthetic-independent-event-01',
  verifiedAt: new Date('2026-10-25T00:00:00.000Z'),
  ...overrides,
})

describe('bank evidence trust boundary', () => {
  it('rejects statements without an independently verified source reference', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('MAINTAINEX_TRUSTED_BANK_EVIDENCE_SOURCES', 'approved-bank-feed')
    expect(() => assertTrustedBankEvidenceSource(statement({ verificationRef: null })))
      .toThrow('BANK_VERIFICATION_PROVENANCE_MISMATCH')
  })

  it('rejects HMAC-verified statements whose verifier is not the statement source', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('MAINTAINEX_TRUSTED_BANK_EVIDENCE_SOURCES', 'approved-bank-feed')
    expect(() => assertTrustedBankEvidenceSource(statement({ verificationSource: 'operator-entered' })))
      .toThrow('BANK_VERIFICATION_PROVENANCE_MISMATCH')
  })

  it('does not treat an authenticated callback as trusted-bank provenance', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('MAINTAINEX_TRUSTED_BANK_EVIDENCE_SOURCES', 'approved-bank-feed')
    expect(() => assertTrustedBankEvidenceSource(statement({ provenanceType: 'STATEMENT_FILE' })))
      .toThrow('BANK_SOURCE_NOT_TRUSTED')
  })

  it('accepts only an explicitly allowlisted bank feed in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('MAINTAINEX_TRUSTED_BANK_EVIDENCE_SOURCES', 'approved-bank-feed')
    expect(() => assertTrustedBankEvidenceSource(statement())).not.toThrow()
    expect(() => assertTrustedBankEvidenceSource(statement({ sourceSystem: 'unknown-feed', verificationSource: 'unknown-feed' })))
      .toThrow('BANK_SOURCE_NOT_TRUSTED')
  })
})
