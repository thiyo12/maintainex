/**
 * Beta Certification Test Account Utilities
 *
 * Controls the 000000 OTP bypass for synthetic certification accounts only.
 * The bypass requires ALLOW_TEST_OTP=true and never applies to ordinary users.
 */

export const CERT_TAG = 'BETA_CERT_2026_09'

// North American 555-01xx numbers are reserved for fictional use.
// These three are dedicated MaintainEX interactive simulator accounts.
export const INTERACTIVE_TEST_PHONES = {
  CUSTOMER: '+12025550101',
  TASKER: '+12025550102',
  COMPANY: '+12025550103',
} as const

function normalizedPhone(value?: string | null): string {
  return (value || '').replace(/\D/g, '')
}

function isInteractiveTestPhone(phone?: string | null): boolean {
  const digits = normalizedPhone(phone)
  return Object.values(INTERACTIVE_TEST_PHONES).some(value => normalizedPhone(value) === digits)
}

/**
 * Check if a user is a synthetic certification account.
 * Nothing is bypassed unless ALLOW_TEST_OTP=true.
 */
export function isSyntheticCertAccount(user: { email?: string | null; phone?: string | null; name?: string | null }): boolean {
  if (process.env.ALLOW_TEST_OTP !== 'true') return false

  const fields = [user.email, user.phone, user.name].filter(Boolean)
  if (fields.some(f => f?.includes(CERT_TAG) ?? false)) return true
  if (isInteractiveTestPhone(user.phone)) return true

  // Existing seeded beta Tasker range.
  const phoneDigits = normalizedPhone(user.phone)
  const local = phoneDigits.slice(-10)
  return /^07710000(?:0[1-9]|1[0-5])$/.test(local)
}

/**
 * 000000 is accepted only for the synthetic accounts above.
 */
export function isTestOtpAllowed(user: { email?: string | null; phone?: string | null; name?: string | null }, code: string): boolean {
  return code === '000000' && isSyntheticCertAccount(user)
}
