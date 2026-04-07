import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, isSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { logActivity } from '@/lib/activity-log'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !isSuperAdmin(session)) {
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
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !isSuperAdmin(session)) {
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
        branchId: role === 'ADMIN' ? branchId : null
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
      adminId: (session.user as any).id,
      adminEmail: session.user!.email!,
      adminName: session.user!.name,
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
