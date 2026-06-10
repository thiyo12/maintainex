import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MODERATOR']

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!ALLOWED_ROLES.includes(session.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const existing = await prisma.jobCategory.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 },
      )
    }

    const updates: any = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.iconName !== undefined) updates.iconName = body.iconName
    if (body.colorHex !== undefined) updates.colorHex = body.colorHex
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder
    if (body.countries !== undefined) updates.countries = body.countries
    if (body.isActive !== undefined) updates.isActive = body.isActive

    const updated = await prisma.jobCategory.update({
      where: { id: params.id },
      data: updates,
    })

    await prisma.auditLog.create({
      data: {
        adminUserId: session.id,
        adminEmail: session.email,
        adminRole: session.role,
        action: 'UPDATE',
        targetTable: 'JobCategory',
        targetId: params.id,
        targetLabel: existing.name,
        oldValue: existing,
        newValue: updated,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || null,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Category update error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update category' },
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

  if (!ALLOWED_ROLES.includes(session.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const existing = await prisma.jobCategory.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 },
      )
    }

    await prisma.jobCategory.update({
      where: { id: params.id },
      data: { isActive: false },
    })

    await prisma.auditLog.create({
      data: {
        adminUserId: session.id,
        adminEmail: session.email,
        adminRole: session.role,
        action: 'DELETE',
        targetTable: 'JobCategory',
        targetId: params.id,
        targetLabel: existing.name,
        oldValue: existing,
        newValue: { isActive: false },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Category delete error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete category' },
      { status: 500 },
    )
  }
}
