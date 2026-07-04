import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function GET() {
  try {
    const settings = await prisma.appSetting.findMany({
      orderBy: [{ groupName: 'asc' }, { key: 'asc' }],
    })

    // Group by groupName
    const grouped: Record<string, any[]> = {}
    for (const s of settings) {
      if (!grouped[s.groupName]) grouped[s.groupName] = []
      grouped[s.groupName].push(s)
    }

    return NextResponse.json({ success: true, data: grouped })
  } catch (error) {
    console.error('Get app settings error:', error)
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { key, value } = await request.json()
    if (!key || value === undefined) {
      return NextResponse.json({ error: 'key and value required' }, { status: 400 })
    }

    const setting = await prisma.appSetting.update({
      where: { key },
      data: { value: String(value), updatedBy: session.id },
    })

    return NextResponse.json({ success: true, data: setting })
  } catch (error) {
    console.error('Update app setting error:', error)
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 })
  }
}
