import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, createAuditLog, getIp } from '@/lib/admin-rbac'
import { updateSettingsSchema } from '@/lib/admin-schemas'

export async function GET(request: NextRequest) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    let settings = await prisma.platformSettings.findFirst()
    if (!settings) {
      settings = await prisma.platformSettings.create({ data: {} })
    }
    return NextResponse.json({
      success: true,
      data: {
        ...settings,
        minJobAmountCents: Number(settings.minJobAmountCents),
        maxJobAmountCents: Number(settings.maxJobAmountCents),
      },
    })
  } catch (e) {
    console.error('Settings error:', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    const body = await request.json()
    const data = updateSettingsSchema.parse(body)

    const oldSettings = await prisma.platformSettings.findFirst()

    const updates: any = {}
    if (data.platformFeeBps !== undefined) updates.platformFeeBps = data.platformFeeBps
    if (data.minJobAmountCents !== undefined) updates.minJobAmountCents = BigInt(data.minJobAmountCents)
    if (data.maxJobAmountCents !== undefined) updates.maxJobAmountCents = BigInt(data.maxJobAmountCents)
    if (data.escrowReleaseDays !== undefined) updates.escrowReleaseDays = data.escrowReleaseDays
    if (data.supportEmail !== undefined) updates.supportEmail = data.supportEmail
    updates.updatedBy = session.id

    let settings
    if (oldSettings) {
      settings = await prisma.platformSettings.update({
        where: { id: oldSettings.id },
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

    await createAuditLog({
      session,
      action: 'SETTINGS_UPDATE',
      targetTable: 'PlatformSettings',
      targetId: settings.id,
      targetLabel: 'Platform Settings',
      oldValue: oldSettings ? JSON.parse(JSON.stringify(oldSettings)) : {},
      newValue: JSON.parse(JSON.stringify(updates)),
      ipAddress: getIp(request),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({
      success: true,
      data: {
        ...settings,
        minJobAmountCents: Number(settings.minJobAmountCents),
        maxJobAmountCents: Number(settings.maxJobAmountCents),
      },
    })
  } catch (e) {
    console.error('Settings update error:', e)
    return NextResponse.json({ success: false, error: 'Failed to update settings' }, { status: 500 })
  }
}
