import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-log'

export async function GET() {
  try {
    const settings = await prisma.settings.findMany()
    
    const settingsObj: Record<string, string> = {}
    settings.forEach(s => {
      settingsObj[s.key] = s.value
    })

    return NextResponse.json(settingsObj)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - Super Admin only' }, { status: 403 })
    }

    const body = await request.json()
    
    for (const [key, value] of Object.entries(body)) {
      await prisma.settings.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      })
    }

    await logActivity({
      adminId: session.id,
      adminEmail: session.email,
      adminName: session.name,
      action: 'UPDATE',
      entityType: 'SETTINGS',
      entityId: 'site_settings',
      description: 'Updated company settings',
      details: { updatedFields: Object.keys(body) }
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
