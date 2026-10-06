import { NextRequest, NextResponse } from 'next/server'
import { guardCrmRequest } from '@/lib/crm/security'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-log'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'settings:view',
      level: 'read',
    })
    if (!guard.ok) return guard.response

    const settings = await prisma.settings.findMany()

    const settingsObj: Record<string, string> = {}
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value
    })

    return NextResponse.json(settingsObj)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'settings:edit',
      permissionClass: 'SENSITIVE',
      allowedRoles: ['SUPER_ADMIN'],
      level: 'sensitive',
    })
    if (!guard.ok) return guard.response

    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid settings payload' }, { status: 400 })
    }

    for (const [key, value] of Object.entries(body)) {
      if (!key || key.length > 160) {
        return NextResponse.json({ error: 'Invalid setting key' }, { status: 400 })
      }
      await prisma.settings.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    }

    await logActivity({
      adminId: guard.context.adminId,
      adminEmail: guard.context.email,
      adminName: guard.context.email,
      action: 'UPDATE',
      entityType: 'SETTINGS',
      entityId: 'site_settings',
      description: 'Updated company settings',
      details: { updatedFields: Object.keys(body) },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
