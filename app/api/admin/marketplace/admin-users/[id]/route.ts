import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    if (params.id === session.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot modify own account' },
        { status: 400 },
      )
    }

    const existing = await prisma.adminUser.findUnique({
      where: { id: params.id },
    })
    if (!existing || existing.deletedAt) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 },
      )
    }

    if (existing.parentId !== session.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot manage this admin' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const updates: any = {}
    if (body.role !== undefined) updates.role = body.role
    if (body.firstName !== undefined) updates.firstName = body.firstName
    if (body.lastName !== undefined) updates.lastName = body.lastName
    if (body.isActive !== undefined) updates.isActive = body.isActive
    if (body.assignedCountries !== undefined)
      updates.assignedCountries = body.assignedCountries
    if (body.password) {
      updates.passwordHash = await bcrypt.hash(body.password, 12)
    }

    const updated = await prisma.adminUser.update({
      where: { id: params.id },
      data: updates,
    })

    await prisma.auditLog.create({
      data: {
        adminUserId: session.id,
        adminEmail: session.email,
        adminRole: session.role,
        action: 'ADMIN_UPDATE',
        targetTable: 'AdminUser',
        targetId: params.id,
        targetLabel: `${existing.firstName} ${existing.lastName}`,
        oldValue: existing,
        newValue: updated,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Admin update error:', e)
    return NextResponse.json(
      { success: false, error: 'Failed to update admin' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    if (params.id === session.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete own account' },
        { status: 400 },
      )
    }

    const existing = await prisma.adminUser.findUnique({
      where: { id: params.id },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 },
      )
    }

    if (existing.parentId !== session.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot manage this admin' },
        { status: 403 },
      )
    }

    await prisma.adminUser.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), isActive: false },
    })

    await prisma.auditLog.create({
      data: {
        adminUserId: session.id,
        adminEmail: session.email,
        adminRole: session.role,
        action: 'DELETE',
        targetTable: 'AdminUser',
        targetId: params.id,
        targetLabel: `${existing.firstName} ${existing.lastName}`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Admin delete error:', e)
    return NextResponse.json(
      { success: false, error: 'Failed to delete admin' },
      { status: 500 },
    )
  }
}
