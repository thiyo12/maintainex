import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSimpleToken, verifySimpleToken } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.json({ success: false, error: 'No session' }, { status: 401 })
    }

    const payload = verifySimpleToken(token)
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 })
    }

    if (payload.authType === 'admin') {
      const admin = await prisma.admin.findUnique({ where: { id: payload.id } })
      if (!admin || !admin.isActive) {
        return NextResponse.json({ success: false, error: 'Account not active' }, { status: 401 })
      }
    } else if (payload.authType === 'adminUser') {
      const adminUser = await prisma.adminUser.findUnique({ where: { id: payload.id } })
      if (!adminUser || !adminUser.isActive || adminUser.deletedAt) {
        return NextResponse.json({ success: false, error: 'Account not active' }, { status: 401 })
      }
    }

    const newToken = createSimpleToken({
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: payload.name,
      authType: payload.authType,
      ...(payload.authType === 'admin' ? {
        branchId: payload.branchId,
        province: payload.province,
        region: payload.region,
        canEditServices: payload.canEditServices,
      } : {}),
    })

    const response = NextResponse.json({
      success: true,
      accessToken: newToken,
    })

    const isProduction = process.env.NODE_ENV === 'production'
    const isHttpUrl = process.env.NEXTAUTH_URL?.startsWith('http://')
    response.cookies.set('admin_token', newToken, {
      httpOnly: true,
      secure: isProduction && !isHttpUrl,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })

    return response
  } catch (error) {
    console.error('Refresh error:', error)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
