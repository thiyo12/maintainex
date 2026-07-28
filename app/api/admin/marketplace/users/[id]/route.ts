import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, createAuditLog, getIp } from '@/lib/admin-rbac'
import { z } from 'zod'

const actionSchema = z.object({
  action: z.enum(['suspend', 'unsuspend', 'ban', 'unban']),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
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
        isSuspended: true,
        suspendedUntil: true,
        suspensionReason: true,
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

    const isBanned = !user.isActive && !user.isSuspended

    return NextResponse.json({ success: true, data: { ...user, isBanned } })
  } catch (e) {
    console.error('User detail error:', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch user' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    const body = await request.json()
    const { action } = actionSchema.parse(body)

    const user = await prisma.user.findUnique({ where: { id: params.id } })
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    let updateData: any = {}
    let auditAction: string = ''

    switch (action) {
      case 'suspend':
        updateData = { isActive: false, isSuspended: true }
        auditAction = 'SUSPEND'
        break
      case 'unsuspend':
        updateData = { isActive: true, isSuspended: false, suspendedUntil: null, suspensionReason: null }
        auditAction = 'UNSUSPEND'
        break
      case 'ban':
        updateData = { isActive: false, isSuspended: false }
        auditAction = 'BAN'
        break
      case 'unban':
        updateData = { isActive: true, isSuspended: false }
        auditAction = 'UNBAN'
        break
    }

    await prisma.user.update({ where: { id: params.id }, data: updateData })

    await createAuditLog({
      session,
      action: auditAction as any,
      targetTable: 'User',
      targetId: params.id,
      targetLabel: `${user.name} (${user.email})`,
      oldValue: JSON.parse(JSON.stringify({ isActive: user.isActive })),
      newValue: JSON.parse(JSON.stringify(updateData)),
      ipAddress: getIp(request),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('User update error:', e)
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 })
  }
}
