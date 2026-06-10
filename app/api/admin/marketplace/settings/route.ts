import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    let settings = await prisma.platformSettings.findFirst()
    if (!settings) {
      settings = await prisma.platformSettings.create({ data: {} })
    }
    return NextResponse.json({ success: true, data: settings })
  } catch (e) {
    console.error('Settings error:', e)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const updates: any = {}
    if (body.platformFeeBps !== undefined) updates.platformFeeBps = body.platformFeeBps
    if (body.minJobAmountCents !== undefined)
      updates.minJobAmountCents = BigInt(body.minJobAmountCents)
    if (body.maxJobAmountCents !== undefined)
      updates.maxJobAmountCents = BigInt(body.maxJobAmountCents)
    if (body.escrowReleaseDays !== undefined)
      updates.escrowReleaseDays = body.escrowReleaseDays
    if (body.supportEmail !== undefined) updates.supportEmail = body.supportEmail
    updates.updatedBy = session.id

    const oldSettings = await prisma.platformSettings.findFirst()

    let settings = await prisma.platformSettings.findFirst()
    if (settings) {
      settings = await prisma.platformSettings.update({
        where: { id: settings.id },
        data: updates,
      })
    } else {
      settings = await prisma.platformSettings.create({
        data: {
          ...updates,
          minJobAmountCents: updates.minJobAmountCents || BigInt(500),
          maxJobAmountCents: updates.maxJobAmountCents || BigInt(1000000),
        },
      })
    }

    await prisma.auditLog.create({
      data: {
        adminUserId: session.id,
        adminEmail: session.email,
        adminRole: session.role,
        action: 'SETTINGS_UPDATE',
        targetTable: 'PlatformSettings',
        targetId: settings.id,
        targetLabel: 'Platform Settings',
        oldValue: oldSettings ? JSON.parse(JSON.stringify(oldSettings)) : {},
        newValue: JSON.parse(JSON.stringify(updates)),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || null,
      },
    })

    return NextResponse.json({ success: true, data: settings })
  } catch (e) {
    console.error('Settings update error:', e)
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 },
    )
  }
}
