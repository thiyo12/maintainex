import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAccessToken } from '@/lib/auth/authentication/admin-jwt'
import { generateTotpSecret, generateTotpUri } from '@/lib/admin-2fa'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyAccessToken(authHeader.slice(7))
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const adminUser = await prisma.adminUser.findUnique({ where: { id: payload.sub } })
    if (!adminUser || !adminUser.isActive) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const secret = generateTotpSecret()
    const uri = generateTotpUri(secret, adminUser.email)

    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { totpSecret: secret, totpEnabled: false },
    })

    return NextResponse.json({ secret, uri })
  } catch (error) {
    console.error('2FA setup error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
