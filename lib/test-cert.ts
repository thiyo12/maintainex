/**
 * Beta and interactive certification test account utilities.
 *
 * 000000 is never accepted for ordinary users. Interactive demo accounts and
 * beta certification accounts are enabled only when ALLOW_TEST_OTP=true.
 */

export const CERT_TAG = 'BETA_CERT_2026_09'

export const INTERACTIVE_TEST_PHONES = {
  CUSTOMER: '+12025550101',
  TASKER: '+12025550102',
  COMPANY: '+12025550103',
} as const

export type InteractiveTestRole = keyof typeof INTERACTIVE_TEST_PHONES

function normalizedPhone(value?: string | null): string {
  return (value || '').replace(/\D/g, '')
}

export function getInteractiveTestRole(phone?: string | null): InteractiveTestRole | null {
  if (process.env.ALLOW_TEST_OTP !== 'true') return null
  const digits = normalizedPhone(phone)
  for (const [role, value] of Object.entries(INTERACTIVE_TEST_PHONES) as Array<[InteractiveTestRole, string]>) {
    if (normalizedPhone(value) === digits) return role
  }
  return null
}

export function isInteractiveTestPhone(phone?: string | null): boolean {
  return getInteractiveTestRole(phone) !== null
}

export function isSyntheticCertAccount(user: { email?: string | null; phone?: string | null; name?: string | null }): boolean {
  if (process.env.ALLOW_TEST_OTP !== 'true') return false

  if (isInteractiveTestPhone(user.phone)) return true

  const fields = [user.email, user.phone, user.name].filter(Boolean)
  if (fields.some(f => f?.includes(CERT_TAG) ?? false)) return true

  const phoneDigits = normalizedPhone(user.phone)
  const local = phoneDigits.slice(-10)
  return /^07710000(?:0[1-9]|1[0-5])$/.test(local)
}

export function isTestOtpAllowed(user: { email?: string | null; phone?: string | null; name?: string | null }, code: string): boolean {
  return code === '000000' && isSyntheticCertAccount(user)
}
