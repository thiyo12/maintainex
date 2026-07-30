import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { logActivity } from '@/lib/activity-log'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - Super Admin only' }, { status: 401 })
    }

    const admins = await prisma.admin.findMany({
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            location: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const safeAdmins = admins.map(admin => ({
      ...admin,
      password: undefined
    }))

    return NextResponse.json(safeAdmins)
  } catch (error) {
    console.error('Error fetching admins:', error)
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - Super Admin only' }, { status: 401 })
    }

    const body = await request.json()
    const { email, password, name, role, branchId, region } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    if (!['SUPER_ADMIN', 'OPERATIONS', 'FINANCE'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    if (['OPERATIONS', 'FINANCE'].includes(role) && !branchId && !region) {
      return NextResponse.json({ error: 'Branch or region is required for admin users' }, { status: 400 })
    }

    const existingAdmin = await prisma.admin.findUnique({
      where: { email }
    })

    if (existingAdmin) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const admin = await prisma.admin.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        role,
        branchId: ['OPERATIONS', 'FINANCE'].includes(role) ? branchId : null,
        region: region || 'LK',
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            location: true
          }
        }
      }
    })

    await logActivity({
      adminId: session.id,
      adminEmail: session.email,
      adminName: session.name,
      action: 'CREATE',
      entityType: 'ADMIN',
      entityId: admin.id,
      description: `Created ${role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'} "${name || email}"`,
      details: { email, role, branchId }
    })

    const safeAdmin = {
      ...admin,
      password: undefined
    }

    return NextResponse.json(safeAdmin, { status: 201 })
  } catch (error) {
    console.error('Error creating admin:', error)
    return NextResponse.json({ error: 'Failed to create admin' }, { status: 500 })
  }
}
