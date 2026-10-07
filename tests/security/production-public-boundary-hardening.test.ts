import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('production public/auth boundary hardening', () => {
  it('retires legacy JWT_SECRET authentication from production compatibility routes', () => {
    const auth = source('lib/auth/authentication/auth-utils.ts')

    expect(auth).toContain('authenticateMarketplaceUser(request)')
    expect(auth).toContain('verifyStaffAccessToken')
    expect(auth).toContain('getActiveStaffSession')
    expect(auth).toContain("process.env.NODE_ENV !== 'production'")
    expect(auth).toContain('verifySimpleToken')
    expect(auth).toContain("authType: 'MARKETPLACE'")
    expect(auth).toContain("authType: 'STAFF'")
  })

  it('password reset is fail-closed rate limited and revokes all active marketplace sessions', () => {
    const forgot = source('app/api/auth/forgot-password/route.ts')
    const reset = source('app/api/auth/reset-password/route.ts')

    expect(forgot).toContain("policyName: 'PASSWORD_RESET'")
    expect(forgot).toContain("keyPrefix: 'password_reset_ip'")
    expect(forgot).toContain("keyPrefix: 'password_reset_account'")
    expect(forgot).toContain('hashKey(normalizedEmail)')
    expect(forgot).toContain('If an account exists with that email')

    expect(reset).toContain("policyName: 'PASSWORD_RESET'")
    expect(reset).toContain("keyPrefix: 'password_reset_verify_ip'")
    expect(reset).toContain("keyPrefix: 'password_reset_token'")
    expect(reset).toContain('prisma.userSession.updateMany')
    expect(reset).toContain("revokeReason: 'password_reset'")
  })

  it('public review submissions are throttled and use a disabled internal guest identity', () => {
    const reviews = source('app/api/reviews/route.ts')

    expect(reviews).toContain("policyName: 'PUBLIC_SUBMISSION'")
    expect(reviews).toContain("keyPrefix: 'public_review_submission'")
    expect(reviews).toContain('review-guest@internal.maintainex.invalid')
    expect(reviews).toContain('isActive: false')
    expect(reviews).toContain('hashPassword(randomBytes(32)')
    expect(reviews).toContain('serviceId, isActive: true')
    expect(reviews).not.toContain('maintainex.lk@gmail.com')
    expect(reviews).not.toContain("passwordHash: 'guest'")
  })

  it('waitlist duplicates do not disclose account membership', () => {
    const waitlist = source('app/api/waitlist/route.ts')

    expect(waitlist).toContain("policyName: 'PUBLIC_SUBMISSION'")
    expect(waitlist).toContain("keyPrefix: 'waitlist_submission'")
    expect(waitlist).toContain("if (error?.code === 'P2002')")
    expect(waitlist).toContain("return NextResponse.json({ success: true, message: \"You're on the waitlist!\" })")
    expect(waitlist).not.toContain('This email is already registered.')
    expect(waitlist).not.toContain('This phone number is already registered.')
  })

  it('public application submissions accept only MaintainEX-controlled HTTPS CV references', () => {
    const applications = source('app/api/applications/route.ts')

    expect(applications).toContain("policyName: 'PUBLIC_SUBMISSION'")
    expect(applications).toContain("keyPrefix: 'public_application_submission'")
    expect(applications).toContain("host !== 'res.cloudinary.com'")
    expect(applications).toContain('/maintainex\\/cvs\\//')
    expect(applications).toContain("url.protocol !== 'https:'")
    expect(applications).toContain('Invalid CV reference')
  })

  it('public price suggestion is throttled and validates minor-unit amounts before BigInt use', () => {
    const pricing = source('app/api/price-suggest/route.ts')

    expect(pricing).toContain("policyName: 'PRICING_QUERY'")
    expect(pricing).toContain("keyPrefix: 'public_price_suggest'")
    expect(pricing).toContain('function parseMinorAmount')
    expect(pricing).toContain('Number.isSafeInteger(value)')
    expect(pricing).toContain('Invalid proposedAmountCents')
    expect(pricing).not.toContain('BigInt(proposedAmountCents)')
  })

  it('generic and service uploads are rate/size/content/privilege guarded', () => {
    const generic = source('app/api/upload/route.ts')
    const service = source('app/api/upload/service/route.ts')
    const validation = source('lib/security/file-upload.ts')

    expect(generic).toContain("policyName: 'UPLOAD'")
    expect(generic).toContain("keyPrefix: 'generic_upload'")
    expect(generic).toContain('MAX_UPLOAD_BYTES')
    expect(generic).toContain("folder === 'industries' && session.role !== 'SUPER_ADMIN'")
    expect(generic).toContain('Invalid file type')

    expect(service).toContain('guardCrmRequest')
    expect(service).toContain("allowedRoles: ['SUPER_ADMIN']")
    expect(service).toContain("permission: 'catalog:edit'")
    expect(service).toContain("policyName: 'UPLOAD'")
    expect(service).toContain('validateFileUpload')

    expect(validation).toContain("declaredMimeType === 'image/webp'")
    expect(validation).toContain("buffer.slice(8, 12).toString('ascii') !== 'WEBP'")
  })

  it('CV upload uses canonical marketplace auth, fail-closed throttling and PDF content validation', () => {
    const cv = source('app/api/upload/cv/route.ts')

    expect(cv).toContain('authenticateMarketplaceUser(request)')
    expect(cv).toContain('assertNotSuspended')
    expect(cv).toContain("policyName: 'UPLOAD'")
    expect(cv).toContain("keyPrefix: 'cv_upload'")
    expect(cv).toContain("file.type !== 'application/pdf'")
    expect(cv).toContain('validateFileUpload(buffer, file.type, file.name)')
    expect(cv).toContain('generateSecureFilename')
    expect(cv).not.toContain('getSession(request)')
  })

  it('booking invoice creation uses the canonical sensitive CRM finance guard', () => {
    const invoice = source('app/api/bookings/[id]/invoice/route.ts')

    expect(invoice).toContain('guardCrmRequest')
    expect(invoice).toContain("permission: 'commission:manage'")
    expect(invoice).toContain("permissionClass: 'SENSITIVE'")
    expect(invoice).toContain('requireCountryScope: true')
    expect(invoice).toContain('resolveReportBranchScope')
    expect(invoice).not.toContain('session.canEditServices')
  })
})
