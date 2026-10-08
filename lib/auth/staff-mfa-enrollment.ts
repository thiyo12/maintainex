import jwt from 'jsonwebtoken'

/**
 * Short-lived staff MFA enrollment token.
 *
 * An unenrolled SUPER_ADMIN cannot obtain a CRM session (the CRM guard requires
 * `totpEnabled`), so first enrollment needs a narrow credential that is only
 * accepted by the two enrollment endpoints. This token is deliberately scoped so
 * it can never be exchanged for, or accepted as, a CRM credential:
 *
 * - different audience (`maintainex-staff-mfa-enrollment`) than the normal
 *   staff access token, so `verifyStaffAccessToken` rejects it
 * - different token `type` (`staff_mfa_enrollment`) than the `2fa_verify`
 *   temporary token, so `/2fa/verify` rejects it
 * - different `purpose` (`2fa_enroll`)
 * - max 5 minute lifetime
 * - carries no session id, so no AdminSession can be looked up from it
 */
export const STAFF_MFA_ENROLLMENT_AUDIENCE = 'maintainex-staff-mfa-enrollment'
export const STAFF_MFA_ENROLLMENT_TYPE = 'staff_mfa_enrollment'
export const STAFF_MFA_ENROLLMENT_PURPOSE = '2fa_enroll'
/**
 * Bounded lifetime. Ten minutes covers scanning, adding the account in the
 * authenticator and entering the first real code, without becoming a durable
 * credential. Still enrollment-only: wrong audience, wrong type, no session id.
 */
export const STAFF_MFA_ENROLLMENT_TTL_SECONDS = 10 * 60

export type StaffMfaEnrollmentClaims = {
  sub: string
  email: string
}

function getEnrollmentSecret(): string {
  const secret = process.env.STAFF_JWT_SECRET
  if (!secret) {
    throw new Error('[SECURITY] STAFF_JWT_SECRET env var is required')
  }
  return secret
}

export function issueStaffMfaEnrollmentToken(params: {
  adminUserId: string
  email: string
}): string {
  return jwt.sign(
    {
      sub: params.adminUserId,
      email: params.email,
      purpose: STAFF_MFA_ENROLLMENT_PURPOSE,
      type: STAFF_MFA_ENROLLMENT_TYPE,
    },
    getEnrollmentSecret(),
    {
      expiresIn: STAFF_MFA_ENROLLMENT_TTL_SECONDS,
      audience: STAFF_MFA_ENROLLMENT_AUDIENCE,
      issuer: 'maintainex',
    }
  )
}

/**
 * Verifies the enrollment token and returns its subject, or null when the token
 * is absent, malformed, expired, or scoped to any other audience/type/purpose.
 */
export function verifyStaffMfaEnrollmentToken(
  token: string | null | undefined,
): StaffMfaEnrollmentClaims | null {
  if (!token || typeof token !== 'string') return null
  try {
    const payload = jwt.verify(token, getEnrollmentSecret(), {
      audience: STAFF_MFA_ENROLLMENT_AUDIENCE,
      issuer: 'maintainex',
    }) as Record<string, unknown>

    if (payload.type !== STAFF_MFA_ENROLLMENT_TYPE) return null
    if (payload.purpose !== STAFF_MFA_ENROLLMENT_PURPOSE) return null
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null

    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : '',
    }
  } catch {
    return null
  }
}

/**
 * Live account gate shared by the enrollment endpoints. Never trusts the token
 * alone: role, activation, lock, deletion and enrollment state are re-read from
 * the database on every call.
 */
export async function resolveEnrollmentSubject(
  adminUserId: string,
): Promise<
  | { ok: true; adminUser: { id: string; email: string; role: string; totpEnabled: boolean; totpSecret: string | null } }
  | { ok: false; status: number; error: string }
> {
  const { prisma } = await import('@/lib/prisma')
  const adminUser = await prisma.adminUser.findUnique({
    where: { id: adminUserId },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      deletedAt: true,
      lockedUntil: true,
      totpEnabled: true,
      totpSecret: true,
    },
  })

  if (!adminUser || !adminUser.isActive || adminUser.deletedAt) {
    return { ok: false, status: 401, error: 'Account is not available.' }
  }
  if (adminUser.lockedUntil && adminUser.lockedUntil > new Date()) {
    return { ok: false, status: 423, error: 'Account is locked.' }
  }
  if (adminUser.role !== 'SUPER_ADMIN') {
    return { ok: false, status: 403, error: 'Enrollment token is not valid for this account.' }
  }

  return { ok: true, adminUser }
}