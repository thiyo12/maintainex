import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, isSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-log'

export async function GET() {
  try {
    let settings = await prisma.settings.findFirst()

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: 'site_settings',
          companyName: 'Maintainex',
          email: 'info@maintainex.com',
          phone: '+94 XX XXX XXXX',
          address: 'Sri Lanka'
        }
      })
    }

    return NextResponse.json(settings)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isSuperAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized - Super Admin only' }, { status: 403 })
    }

    const body = await request.json()
    
    const settings = await prisma.settings.upsert({
      where: { id: 'site_settings' },
      update: body,
      create: {
        id: 'site_settings',
        companyName: 'Maintainex',
        email: 'info@maintainex.com',
        phone: '+94 XX XXX XXXX',
        address: 'Sri Lanka',
        ...body
      }
    })

    await logActivity({
      adminId: (session.user as any).id,
      adminEmail: session.user!.email!,
      adminName: session.user!.name,
      action: 'UPDATE',
      entityType: 'SETTINGS',
      entityId: 'site_settings',
      description: 'Updated company settings',
      details: { updatedFields: Object.keys(body) }
    })

    return NextResponse.json(settings)
  } catch {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
