import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/shared/observability/logger'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'
import { generateTotpSecret, generateTotpUri } from '@/lib/admin-2fa'
import { verifyPasswordWithMigration } from '@/lib/security/password'

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, { level: 'sensitive' })
    if (!guard.ok) return guard.response

    const adminUser = await prisma.adminUser.findUnique({ where: { id: guard.context.adminId } })
    if (!adminUser || !adminUser.isActive || adminUser.deletedAt) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    if (adminUser.totpEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is already enabled.' },
        { status: 409 }
      )
    }

    const body = await request.json().catch(() => ({}))
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
