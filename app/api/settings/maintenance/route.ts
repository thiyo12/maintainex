import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions, isSuperAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: 'site_settings' }
    })

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: 'site_settings',
          companyName: 'Maintainex',
          email: 'info@maintainex.com',
          phone: '+94 XX XXX XXXX',
          address: 'Sri Lanka',
          maintenanceMode: false,
          maintenanceMessage: "We're making things better! Our website is currently undergoing some scheduled maintenance to serve you better. We'll be back shortly. Thank you for your patience!"
        }
      })
    }

    const response = NextResponse.json({
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage
    })
    
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response
  } catch {
    return NextResponse.json({ 
      maintenanceMode: false, 
      maintenanceMessage: "We're making things better!" 
    }, { status: 200 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !isSuperAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized - Super Admin only' }, { status: 401 })
    }

    const body = await request.json()
    const { maintenanceMode, maintenanceMessage } = body

    const settings = await prisma.settings.upsert({
      where: { id: 'site_settings' },
      update: {
        maintenanceMode: maintenanceMode !== undefined ? maintenanceMode : false,
        maintenanceMessage: maintenanceMessage !== undefined ? maintenanceMessage : "We're making things better!"
      },
      create: {
        id: 'site_settings',
        companyName: 'Maintainex',
        email: 'info@maintainex.com',
        phone: '+94 XX XXX XXXX',
        address: 'Sri Lanka',
        maintenanceMode: maintenanceMode !== undefined ? maintenanceMode : false,
        maintenanceMessage: maintenanceMessage || "We're making things better!"
      }
    })

    const response = NextResponse.json({
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage
    })
    
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    
    return response
  } catch {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
