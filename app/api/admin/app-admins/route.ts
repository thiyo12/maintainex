import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { verifySimpleToken } from '@/lib/admin-auth'

function getSession(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  if (!token) return null
  const payload = verifySimpleToken(token)
  if (!payload || payload.authType !== 'admin' || payload.role !== 'SUPER_ADMIN') return null
  return payload
}

export async function GET(request: NextRequest) {
  const session = getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admins = await prisma.adminUser.findMany({
      where: { parentId: null, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, email: true, role: true, firstName: true, lastName: true,
        totpEnabled: true, assignedCountries: true, isActive: true,
        lastLoginAt: true, createdAt: true,
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
    console.error('App admins list error:', e)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { email, firstName, lastName, password } = body

    if (!email || !firstName || !lastName) {
      return NextResponse.json({ error: 'Email, firstName, lastName required' }, { status: 400 })
    }

    const existing = await prisma.adminUser.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Admin with this email already exists' }, { status: 409 })
    }

    const tempPassword = password || (Math.random().toString(36).slice(-10) + 'A1!')
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    const newAdmin = await prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        role: 'SUPER_ADMIN',
        firstName,
        lastName,
        assignedCountries: [],
        createdBy: session.id,
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
    console.error('App admin create error:', e)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 })
    }

    const updates: any = {}
    if (isActive !== undefined) updates.isActive = isActive

    await prisma.adminUser.update({ where: { id }, data: updates })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('App admin update error:', e)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 })
    }

    await prisma.adminUser.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('App admin delete error:', e)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
