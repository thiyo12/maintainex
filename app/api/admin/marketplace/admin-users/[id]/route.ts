import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, createAuditLog, getIp } from '@/lib/admin-rbac'
import { updateAdminSchema } from '@/lib/admin-schemas'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    if (params.id === session.id) {
      return NextResponse.json({ success: false, error: 'Cannot modify own account' }, { status: 400 })
    }

    const existing = await prisma.adminUser.findUnique({ where: { id: params.id } })
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ success: false, error: 'Admin not found' }, { status: 404 })
    }

    if (existing.parentId !== session.id) {
      return NextResponse.json({ success: false, error: 'Cannot manage this admin' }, { status: 403 })
    }

    const body = await request.json()
    const data = updateAdminSchema.parse(body)

    const updates: any = {}
    if (data.role !== undefined) updates.role = data.role
    if (data.assignedCountries !== undefined) updates.assignedCountries = data.assignedCountries
    if (data.isActive !== undefined) updates.isActive = data.isActive

    const updated = await prisma.adminUser.update({
      where: { id: params.id },
      data: updates,
    })

    await createAuditLog({
      session,
      action: 'ADMIN_UPDATE',
      targetTable: 'AdminUser',
      targetId: params.id,
      targetLabel: `${existing.firstName} ${existing.lastName}`,
      oldValue: JSON.parse(JSON.stringify({ role: existing.role, assignedCountries: existing.assignedCountries, isActive: existing.isActive })),
      newValue: JSON.parse(JSON.stringify(updates)),
      ipAddress: getIp(request),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Admin update error:', e)
    return NextResponse.json({ success: false, error: 'Failed to update admin' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    if (params.id === session.id) {
      return NextResponse.json({ success: false, error: 'Cannot delete own account' }, { status: 400 })
    }

    const existing = await prisma.adminUser.findUnique({ where: { id: params.id } })
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ success: false, error: 'Admin not found' }, { status: 404 })
    }

    if (existing.parentId !== session.id) {
      return NextResponse.json({ success: false, error: 'Cannot manage this admin' }, { status: 403 })
    }

    await prisma.adminUser.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), isActive: false },
    })

    await createAuditLog({
      session,
      action: 'DELETE',
      targetTable: 'AdminUser',
      targetId: params.id,
      targetLabel: `${existing.firstName} ${existing.lastName}`,
      oldValue: JSON.parse(JSON.stringify({ isActive: existing.isActive, deletedAt: null })),
      newValue: JSON.parse(JSON.stringify({ isActive: false, deletedAt: new Date().toISOString() })),
      ipAddress: getIp(request),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Admin delete error:', e)
    return NextResponse.json({ success: false, error: 'Failed to delete admin' }, { status: 500 })
  }
}
