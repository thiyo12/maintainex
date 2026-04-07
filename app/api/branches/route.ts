import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, isSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-log'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    const { searchParams } = new URL(request.url)
    const includeStats = searchParams.get('includeStats') === 'true'

    const where: any = {}
    if (!isSuperAdmin(session)) {
      where.id = user.branchId
    }

    const branches = await prisma.branch.findMany({
      where,
      include: includeStats ? {
        _count: {
          select: {
            admins: true,
            bookings: true,
            applications: true,
            services: true
          }
        }
      } : undefined,
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json(branches)
  } catch (error) {
    console.error('Error fetching branches:', error)
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !isSuperAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized - Super Admin only' }, { status: 401 })
    }

    const body = await request.json()
    const { name, location, phone, email, address } = body

    if (!name || !location) {
      return NextResponse.json({ error: 'Name and location are required' }, { status: 400 })
    }

    const branch = await prisma.branch.create({
      data: {
        name,
        location,
        phone: phone || null,
        email: email || null,
        address: address || null
      }
    })

    await logActivity({
      adminId: (session.user as any).id,
      adminEmail: session.user!.email!,
      adminName: session.user!.name,
      action: 'CREATE',
      entityType: 'BRANCH',
      entityId: branch.id,
      description: `Created branch "${name}"`,
      details: { name, location }
    })

    return NextResponse.json(branch, { status: 201 })
  } catch (error) {
    console.error('Error creating branch:', error)
    return NextResponse.json({ error: 'Failed to create branch' }, { status: 500 })
  }
}
