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

    const admins = await prisma.adminProfile.findMany({
      include: {
        user: { select: { name: true, email: true } }, branch: {
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
    const { email, password, name, role, branchId } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    if (!['SUPER_ADMIN', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    if (role === 'ADMIN' && !branchId) {
      return NextResponse.json({ error: 'Branch is required for admin users' }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const admin = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name: name || email.split('@')[0],
        phone: null,
        role: role as any,
        status: 'ACTIVE',
        isActive: true,
        emailVerified: false,
        adminProfile: {
          create: {
            role,
            branchId: role === 'ADMIN' ? branchId : null,
          }
        }
      },
      include: {
        adminProfile: {
          include: {
            branch: { select: { id: true, name: true, location: true } }
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
