import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('mobile auth recovery boundary', () => {
  it('sends password-reset OTPs through the configured email channel and rotates old codes', () => {
    const route = read('app/api/mobile/auth/forgot-password/route.ts')
    expect(route).toContain("purpose: 'PASSWORD_RESET'")
    expect(route).toContain('sendOtpEmail(user.email, code)')
    expect(route).toContain("where: { userId: user.id, purpose: 'PASSWORD_RESET', isUsed: false }")
  })

  it('does not deliver reset OTPs to inactive, banned, or actively suspended accounts', () => {
    const route = read('app/api/mobile/auth/forgot-password/route.ts')
    expect(route).toContain('!user.isActive')
    expect(route).toContain('user.isBanned')
    expect(route).toContain('user.isSuspended')
  })

  it('atomically consumes reset codes and revokes all remaining reset codes', () => {
    const route = read('app/api/mobile/auth/reset-password/route.ts')
    expect(route).toContain("where: { id: otpRecord.id, isUsed: false }")
    expect(route).toContain('if (consumed.count !== 1)')
    expect(route).toContain("purpose: 'PASSWORD_RESET'")
    expect(route).toContain('revokeAllUserSessions(user.id')
  })

  it('uses the shared password-strength policy for reset passwords', () => {
    const route = read('app/api/mobile/auth/reset-password/route.ts')
    expect(route).toContain('checkPasswordStrength(newPassword)')
    expect(route).toContain('Password does not meet security requirements')
  })

  it('requires OTP verification for phone-number changes from generic profile editing', () => {
    const route = read('app/api/mobile/auth/profile/route.ts')
    expect(route).toContain('Mobile number changes require OTP verification.')
    expect(route).not.toContain('updateData.phone = phone')
  })

  it('validates customer birthday before Prisma persistence', () => {
    const route = read('app/api/mobile/auth/profile/route.ts')
    expect(route).toContain("birthday must use YYYY-MM-DD")
    expect(route).toContain('Number.isNaN(parsedBirthday.getTime())')
    expect(route).toContain('customerData.birthday = normalizedBirthday')
  })
})
