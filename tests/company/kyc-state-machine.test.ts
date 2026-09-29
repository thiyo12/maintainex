import { describe, it, expect } from 'vitest'
import {
  isValidKycTransition,
  isValidCompanyVerificationTransition,
  isKycVerified,
  isCompanyVerified,
  KYC_VALID_TRANSITIONS,
  COMPANY_VERIFICATION_TRANSITIONS,
  KycStatus,
  CompanyVerificationStatus,
} from '@/lib/phase6/kyc'

describe('Phase 6 — KYC State Machine', () => {
  describe('Individual KYC transitions', () => {
    it('NOT_SUBMITTED -> PENDING is valid', () => {
      expect(isValidKycTransition('NOT_SUBMITTED', 'PENDING')).toBe(true)
    })

    it('NOT_SUBMITTED -> VERIFIED is invalid (skip pending)', () => {
      expect(isValidKycTransition('NOT_SUBMITTED', 'VERIFIED')).toBe(false)
    })

    it('NOT_SUBMITTED -> REJECTED is invalid', () => {
      expect(isValidKycTransition('NOT_SUBMITTED', 'REJECTED')).toBe(false)
    })

    it('PENDING -> VERIFIED is valid', () => {
      expect(isValidKycTransition('PENDING', 'VERIFIED')).toBe(true)
    })

    it('PENDING -> REJECTED is valid', () => {
      expect(isValidKycTransition('PENDING', 'REJECTED')).toBe(true)
    })

    it('PENDING -> NOT_SUBMITTED is invalid', () => {
      expect(isValidKycTransition('PENDING', 'NOT_SUBMITTED')).toBe(false)
    })

    it('VERIFIED -> SUSPENDED is valid', () => {
      expect(isValidKycTransition('VERIFIED', 'SUSPENDED')).toBe(true)
    })

    it('VERIFIED -> EXPIRED is valid', () => {
      expect(isValidKycTransition('VERIFIED', 'EXPIRED')).toBe(true)
    })

    it('VERIFIED -> PENDING is invalid', () => {
      expect(isValidKycTransition('VERIFIED', 'PENDING')).toBe(false)
    })

    it('REJECTED -> PENDING is valid (resubmit)', () => {
      expect(isValidKycTransition('REJECTED', 'PENDING')).toBe(true)
    })

    it('REJECTED -> VERIFIED is invalid (skip pending)', () => {
      expect(isValidKycTransition('REJECTED', 'VERIFIED')).toBe(false)
    })

    it('EXPIRED -> PENDING is valid (renew)', () => {
      expect(isValidKycTransition('EXPIRED', 'PENDING')).toBe(true)
    })

    it('SUSPENDED -> PENDING is valid (appeal)', () => {
      expect(isValidKycTransition('SUSPENDED', 'PENDING')).toBe(true)
    })

    it('SUSPENDED -> VERIFIED is invalid (skip review)', () => {
      expect(isValidKycTransition('SUSPENDED', 'VERIFIED')).toBe(false)
    })

    it('all transitions are defined', () => {
      const statuses: KycStatus[] = ['NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED', 'SUSPENDED']
      for (const status of statuses) {
        expect(KYC_VALID_TRANSITIONS[status]).toBeDefined()
        expect(Array.isArray(KYC_VALID_TRANSITIONS[status])).toBe(true)
      }
    })
  })

  describe('Company verification transitions', () => {
    it('UNVERIFIED -> PENDING is valid', () => {
      expect(isValidCompanyVerificationTransition('UNVERIFIED', 'PENDING')).toBe(true)
    })

    it('UNVERIFIED -> VERIFIED is invalid (skip review)', () => {
      expect(isValidCompanyVerificationTransition('UNVERIFIED', 'VERIFIED')).toBe(false)
    })

    it('PENDING -> VERIFIED is valid', () => {
      expect(isValidCompanyVerificationTransition('PENDING', 'VERIFIED')).toBe(true)
    })

    it('PENDING -> REJECTED is valid', () => {
      expect(isValidCompanyVerificationTransition('PENDING', 'REJECTED')).toBe(true)
    })

    it('VERIFIED -> SUSPENDED is valid', () => {
      expect(isValidCompanyVerificationTransition('VERIFIED', 'SUSPENDED')).toBe(true)
    })

    it('VERIFIED -> PENDING is invalid', () => {
      expect(isValidCompanyVerificationTransition('VERIFIED', 'PENDING')).toBe(false)
    })

    it('REJECTED -> PENDING is valid (resubmit)', () => {
      expect(isValidCompanyVerificationTransition('REJECTED', 'PENDING')).toBe(true)
    })

    it('SUSPENDED -> PENDING is valid (appeal)', () => {
      expect(isValidCompanyVerificationTransition('SUSPENDED', 'PENDING')).toBe(true)
    })

    it('all transitions are defined', () => {
      const statuses: CompanyVerificationStatus[] = ['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED']
      for (const status of statuses) {
        expect(COMPANY_VERIFICATION_TRANSITIONS[status]).toBeDefined()
      }
    })
  })

  describe('Status helpers', () => {
    it('isKycVerified only returns true for VERIFIED', () => {
      expect(isKycVerified('VERIFIED')).toBe(true)
      expect(isKycVerified('PENDING')).toBe(false)
      expect(isKycVerified('REJECTED')).toBe(false)
      expect(isKycVerified('NOT_SUBMITTED')).toBe(false)
      expect(isKycVerified('SUSPENDED')).toBe(false)
      expect(isKycVerified('EXPIRED')).toBe(false)
    })

    it('isCompanyVerified only returns true for VERIFIED', () => {
      expect(isCompanyVerified('VERIFIED')).toBe(true)
      expect(isCompanyVerified('PENDING')).toBe(false)
      expect(isCompanyVerified('REJECTED')).toBe(false)
      expect(isCompanyVerified('UNVERIFIED')).toBe(false)
      expect(isCompanyVerified('SUSPENDED')).toBe(false)
    })
  })

  describe('Illegal transition prevention', () => {
    const illegalTransitions: [KycStatus, KycStatus][] = [
      ['NOT_SUBMITTED', 'VERIFIED'],
      ['NOT_SUBMITTED', 'REJECTED'],
      ['NOT_SUBMITTED', 'SUSPENDED'],
      ['NOT_SUBMITTED', 'EXPIRED'],
      ['PENDING', 'NOT_SUBMITTED'],
      ['PENDING', 'SUSPENDED'],
      ['PENDING', 'EXPIRED'],
      ['VERIFIED', 'NOT_SUBMITTED'],
      ['VERIFIED', 'PENDING'],
      ['REJECTED', 'NOT_SUBMITTED'],
      ['REJECTED', 'VERIFIED'],
      ['REJECTED', 'SUSPENDED'],
      ['REJECTED', 'EXPIRED'],
      ['EXPIRED', 'NOT_SUBMITTED'],
      ['EXPIRED', 'VERIFIED'],
      ['EXPIRED', 'REJECTED'],
      ['EXPIRED', 'SUSPENDED'],
      ['SUSPENDED', 'NOT_SUBMITTED'],
      ['SUSPENDED', 'VERIFIED'],
      ['SUSPENDED', 'REJECTED'],
      ['SUSPENDED', 'EXPIRED'],
    ]

    for (const [from, to] of illegalTransitions) {
      it(`prevents ${from} -> ${to}`, () => {
        expect(isValidKycTransition(from, to)).toBe(false)
      })
    }
  })
})
