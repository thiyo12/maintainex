import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const admins = await prisma.adminUser.findMany({
      where: { deletedAt: null, parentId: session.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        totpEnabled: true,
        assignedCountries: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: admins.map((a) => ({
        ...a,
        lastLoginAt: a.lastLoginAt?.toISOString() || null,
        createdAt: a.createdAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error('Admins list error:', e)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch admins' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { email, firstName, lastName, role, assignedCountries } = body

    if (!email || !firstName || !lastName || !role) {
      return NextResponse.json(
        { success: false, error: 'Email, firstName, lastName, role required' },
        { status: 400 },
      )
    }

    const existing = await prisma.adminUser.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Admin with this email already exists' },
        { status: 409 },
      )
    }

    const tempPassword = Math.random().toString(36).slice(-10) + 'A1!'
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    const newAdmin = await prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        role,
        firstName,
        lastName,
        assignedCountries: assignedCountries || [],
        parentId: session.id,
        createdBy: session.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        adminUserId: session.id,
        adminEmail: session.email,
        adminRole: session.role,
        action: 'ADMIN_CREATE',
        targetTable: 'AdminUser',
        targetId: newAdmin.id,
        targetLabel: `${firstName} ${lastName} (${email})`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || null,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: newAdmin.id,
        email: newAdmin.email,
        role: newAdmin.role,
        firstName: newAdmin.firstName,
        lastName: newAdmin.lastName,
        tempPassword,
      },
    })
  } catch (e) {
    console.error('Admin create error:', e)
    return NextResponse.json(
      { success: false, error: 'Failed to create admin' },
      { status: 500 },
    )
  }
}
