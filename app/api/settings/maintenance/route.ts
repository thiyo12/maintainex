import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const maintenanceModeSetting = await prisma.settings.findUnique({
      where: { key: 'maintenanceMode' }
    })
    const maintenanceMessageSetting = await prisma.settings.findUnique({
      where: { key: 'maintenanceMessage' }
    })

    const response = NextResponse.json({
      maintenanceMode: maintenanceModeSetting?.value === 'true',
      maintenanceMessage: maintenanceMessageSetting?.value || "We're making things better!"
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
    const session = await getSession(request)
    
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - Super Admin only' }, { status: 401 })
    }

    const body = await request.json()
    const { maintenanceMode, maintenanceMessage } = body

    await prisma.settings.upsert({
      where: { key: 'maintenanceMode' },
      update: { value: maintenanceMode !== undefined ? String(maintenanceMode) : 'false' },
      create: { key: 'maintenanceMode', value: maintenanceMode !== undefined ? String(maintenanceMode) : 'false' }
    })

    await prisma.settings.upsert({
      where: { key: 'maintenanceMessage' },
      update: { value: maintenanceMessage || "We're making things better!" },
      create: { key: 'maintenanceMessage', value: maintenanceMessage || "We're making things better!" }
    })

    const response = NextResponse.json({
      maintenanceMode: maintenanceMode !== undefined ? maintenanceMode : false,
      maintenanceMessage: maintenanceMessage || "We're making things better!"
    })
    
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    
    return response
  } catch {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
