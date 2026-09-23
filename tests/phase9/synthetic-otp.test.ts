import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  INTERACTIVE_TEST_PHONES,
  isSyntheticCertAccount,
  isTestOtpAllowed,
} from '@/lib/test-cert'

const originalAllowTestOtp = process.env.ALLOW_TEST_OTP

describe('Synthetic OTP certification accounts', () => {
  beforeEach(() => {
    process.env.ALLOW_TEST_OTP = 'true'
  })

  afterEach(() => {
    if (originalAllowTestOtp === undefined) delete process.env.ALLOW_TEST_OTP
    else process.env.ALLOW_TEST_OTP = originalAllowTestOtp
  })

  it('allows 000000 for the reserved interactive simulator accounts', () => {
    for (const phone of Object.values(INTERACTIVE_TEST_PHONES)) {
      expect(isSyntheticCertAccount({ phone })).toBe(true)
      expect(isTestOtpAllowed({ phone }, '000000')).toBe(true)
    }
  })

  it('never allows 000000 for an ordinary phone number', () => {
    expect(isSyntheticCertAccount({ phone: '+94771234567' })).toBe(false)
    expect(isTestOtpAllowed({ phone: '+94771234567' }, '000000')).toBe(false)
  })

  it('does not accept a different code as the synthetic bypass', () => {
    expect(isTestOtpAllowed({ phone: INTERACTIVE_TEST_PHONES.CUSTOMER }, '123456')).toBe(false)
  })

  it('disables the bypass completely when ALLOW_TEST_OTP is not true', () => {
    process.env.ALLOW_TEST_OTP = 'false'
    expect(isSyntheticCertAccount({ phone: INTERACTIVE_TEST_PHONES.TASKER })).toBe(false)
    expect(isTestOtpAllowed({ phone: INTERACTIVE_TEST_PHONES.TASKER }, '000000')).toBe(false)
  })
})
