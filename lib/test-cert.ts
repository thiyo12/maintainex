/**
 * Beta Certification Test Account Utilities
 *
 * Controls test OTP bypass for synthetic beta certification accounts.
 * Eligible accounts are explicitly tagged with BETA_CERT_2026_09 or use the
 * reserved sample Tasker phone range from prisma/seed-taskers.ts.
 * Requires ALLOW_TEST_OTP=true in environment to function.
 */

export const CERT_TAG = 'BETA_CERT_2026_09'

/**
 * Check if a user is a synthetic certification account.
 * These accounts are created during the 3,000-user beta certification.
 */
export function isSyntheticCertAccount(user: { email?: string | null; phone?: string | null; name?: string | null }): boolean {
  if (process.env.ALLOW_TEST_OTP !== 'true') return false
  const fields = [user.email, user.phone, user.name].filter(Boolean)
  if (fields.some(f => f?.includes(CERT_TAG) ?? false)) return true

  // Reserved sample Tasker range used by prisma/seed-taskers.ts.
  // This bypass is still impossible unless ALLOW_TEST_OTP=true.
  const phoneDigits = (user.phone || '').replace(/\D/g, '')
  const local = phoneDigits.slice(-10)
  return /^07710000(?:0[1-9]|1[0-5])$/.test(local)
}

/**
 * Check if a test OTP (000000) is allowed for this user.
 * Only synthetic certification accounts in test mode can use the bypass.
 */
export function isTestOtpAllowed(user: { email?: string | null; phone?: string | null; name?: string | null }, code: string): boolean {
  if (code !== '000000') return false
  return isSyntheticCertAccount(user)
}
