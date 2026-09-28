import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { getAdminSession } from '@/lib/auth/authentication/admin-auth'

const ALLOWED_ROLES = ['SUPER_ADMIN']

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000)

    const admins = await prisma.adminUser.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdBy: true,
        createdAt: true,
        totpEnabled: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const adminIds = admins.map((a) => a.id)

    const [actionsTodayCounts, lastActiveEntries] = await Promise.all([
      prisma.auditLog.groupBy({
        by: ['adminUserId'],
        where: {
          adminUserId: { in: adminIds },
          createdAt: { gte: startOfToday },
        },
        _count: { id: true },
      }),
      prisma.auditLog.findMany({
        where: { adminUserId: { in: adminIds } },
        select: { adminUserId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        distinct: ['adminUserId'],
      }),
    ])

    const actionsTodayMap = new Map(
      actionsTodayCounts.map((entry) => [entry.adminUserId, entry._count.id])
    )
    const lastActiveMap = new Map(
      lastActiveEntries.map((entry) => [entry.adminUserId, entry.createdAt])
    )

    const adminsWithCreator = await Promise.all(
      admins.map(async (admin) => {
        let createdByName = null
        if (admin.createdBy) {
          const creator = await prisma.adminUser.findUnique({
            where: { id: admin.createdBy },
            select: { firstName: true, lastName: true },
          })
          if (creator) createdByName = `${creator.firstName} ${creator.lastName}`
        }

        const lastActiveAt = lastActiveMap.get(admin.id) ?? null
        const actionsToday = actionsTodayMap.get(admin.id) ?? 0
        const isOnline = lastActiveAt !== null && lastActiveAt >= fiveMinAgo

        return { ...admin, createdByName, actionsToday, lastActiveAt, isOnline }
      })
    )

    return NextResponse.json({ admins: adminsWithCreator })
  } catch (error) {
    console.error('Admins GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const { email, firstName, lastName, role, password, assignedCountries } = body

    if (!email || !firstName || !lastName || !role || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const existing = await prisma.adminUser.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }

    const passwordHash = await hash(password, 12)

    const admin = await prisma.adminUser.create({
      data: {
        email,
        firstName,
        lastName,
        role,
        passwordHash,
        assignedCountries: assignedCountries || '',
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ admin }, { status: 201 })
  } catch (error) {
    console.error('Admins POST error:', error)
    return NextResponse.json({ error: 'Failed to create admin' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const { id, role, isActive, password } = body

    if (!id) {
      return NextResponse.json({ error: 'Admin ID required' }, { status: 400 })
    }

    const updateData: Record<string, any> = {}
    if (role !== undefined) updateData.role = role
    if (isActive !== undefined) updateData.isActive = isActive
    if (password !== undefined) {
      if (typeof password !== 'string' || password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
      }
      updateData.passwordHash = await hash(password, 12)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const admin = await prisma.adminUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    })

    return NextResponse.json({ admin })
  } catch (error) {
    console.error('Admins PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update admin' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Admin ID required' }, { status: 400 })
    }

    await prisma.adminUser.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admins DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete admin' }, { status: 500 })
  }
}
