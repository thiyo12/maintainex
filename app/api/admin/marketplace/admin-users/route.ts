import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, createAuditLog, getIp } from '@/lib/admin-rbac'
import { createAdminSchema } from '@/lib/admin-schemas'

export async function GET(request: NextRequest) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
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
    return NextResponse.json({ success: false, error: 'Failed to fetch admins' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    const body = await request.json()
    const data = createAdminSchema.parse(body)

    const existing = await prisma.adminUser.findUnique({ where: { email: data.email } })
    if (existing) {
      return NextResponse.json({ success: false, error: 'Admin with this email already exists' }, { status: 409 })
    }

    const tempPassword = Math.random().toString(36).slice(-10) + 'A1!'
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    const newAdmin = await prisma.adminUser.create({
      data: {
        email: data.email,
        passwordHash,
        role: data.role,
        firstName: data.firstName,
        lastName: data.lastName,
        assignedCountries: data.assignedCountries,
        parentId: session.id,
        createdBy: session.id,
      },
    })

    await createAuditLog({
      session,
      action: 'ADMIN_CREATE',
      targetTable: 'AdminUser',
      targetId: newAdmin.id,
      targetLabel: `${data.firstName} ${data.lastName} (${data.email})`,
      oldValue: null,
      newValue: JSON.parse(JSON.stringify({ email: data.email, role: data.role, firstName: data.firstName, lastName: data.lastName, assignedCountries: data.assignedCountries })),
      ipAddress: getIp(request),
      userAgent: request.headers.get('user-agent'),
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
    return NextResponse.json({ success: false, error: 'Failed to create admin' }, { status: 500 })
  }
}
