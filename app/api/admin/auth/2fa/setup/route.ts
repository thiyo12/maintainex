import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/shared/observability/logger'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'
import { generateTotpSecret, generateTotpUri } from '@/lib/admin-2fa'
import { verifyPasswordWithMigration } from '@/lib/security/password'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const enrollmentToken =
      typeof body?.enrollmentToken === 'string' ? body.enrollmentToken : null

    // Two accepted proofs of identity for first enrollment:
    //  - a normal authenticated CRM session, or
    //  - the short-lived enrollment token issued to a verified super-admin
    //    password that has never enrolled.
    const { verifyStaffMfaEnrollmentToken, resolveEnrollmentSubject } =
      await import('@/lib/auth/staff-mfa-enrollment')

    const claims = verifyStaffMfaEnrollmentToken(enrollmentToken)
    let adminUser: {
      id: string
      email: string
      role: string
      isActive: boolean
      deletedAt: Date | null
      totpEnabled: boolean
      passwordHash: string
    }

    if (claims) {
      const resolved = await resolveEnrollmentSubject(claims.sub)
      if (!resolved.ok) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status })
      }
      const live = await prisma.adminUser.findUnique({
        where: { id: claims.sub },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          deletedAt: true,
          totpEnabled: true,
          passwordHash: true,
        },
      })
      if (!live) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 })
      }
      adminUser = live
    } else if (enrollmentToken) {
      // A token was supplied but did not verify: never fall back to another path.
      return NextResponse.json({ error: 'Invalid or expired enrollment token' }, { status: 401 })
    } else {
      const guard = await guardCrmRequest(request, { level: 'sensitive' })
      if (!guard.ok) return guard.response

      const sessionAdmin = await prisma.adminUser.findUnique({ where: { id: guard.context.adminId } })
      if (!sessionAdmin || !sessionAdmin.isActive || sessionAdmin.deletedAt) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 })
      }
      adminUser = sessionAdmin
    }

    if (adminUser.totpEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is already enabled.' },
        { status: 409 }
      )
    }

    const currentPassword =
      typeof body?.currentPassword === 'string' ? body.currentPassword : ''

    if (!currentPassword || currentPassword.length > 200) {
      return NextResponse.json(
        { error: 'Current password is required.' },
        { status: 400 }
      )
    }

    const passwordCheck = await verifyPasswordWithMigration(
      currentPassword,
      adminUser.passwordHash
    )
    if (!passwordCheck.valid) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 })
    }

    const secret = generateTotpSecret()
    const uri = generateTotpUri(secret, adminUser.email)

    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: {
        totpSecret: secret,
        totpEnabled: false,
        totpVerifiedAt: null,
      },
    })

    return NextResponse.json(
      { secret, uri },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    logger.error('2FA setup failed unexpectedly', { err: error })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
