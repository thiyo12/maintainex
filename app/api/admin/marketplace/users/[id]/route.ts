import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'ADMIN']

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        identityStatus: true,
        createdAt: true,
        updatedAt: true,
        taskerProfile: true,
        companyProfile: {
          select: {
            companyName: true,
            isVerified: true,
            subscriptionStatus: true,
            rating: true,
          },
        },
        customerProfile: {
          select: {
            customerType: true,
            status: true,
            totalBookings: true,
            totalSpent: true,
          },
        },
        identityDocs: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            docType: true,
            side: true,
            imageUrl: true,
            status: true,
            reviewNote: true,
            createdAt: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    console.error('User detail error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user' },
      { status: 500 },
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!ALLOWED_ROLES.includes(session.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { action, reason } = body

    const user = await prisma.user.findUnique({ where: { id: params.id } })
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    let updateData: any = {}
    let auditAction = ''

    switch (action) {
      case 'suspend':
        updateData = { isActive: false }
        auditAction = 'SUSPEND'
        break
      case 'unsuspend':
        updateData = { isActive: true }
        auditAction = 'UNSUSPEND'
        break
      case 'ban':
        updateData = { isActive: false }
        auditAction = 'BAN'
        break
      case 'unban':
        updateData = { isActive: true }
        auditAction = 'UNBAN'
        break
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 },
        )
    }

    await prisma.user.update({ where: { id: params.id }, data: updateData })

    await prisma.auditLog.create({
      data: {
        adminUserId: session.id,
        adminEmail: session.email,
        adminRole: session.role,
        action: auditAction,
        targetTable: 'User',
        targetId: params.id,
        targetLabel: `${user.name} (${user.email})`,
        oldValue: { isActive: user.isActive },
        newValue: updateData,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('User update error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 },
    )
  }
}
