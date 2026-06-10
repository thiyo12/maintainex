import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, createAuditLog, getIp } from '@/lib/admin-rbac'
import { updateCategorySchema } from '@/lib/admin-schemas'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    const body = await request.json()
    const data = updateCategorySchema.parse(body)

    const existing = await prisma.jobCategory.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 })
    }

    const updates: any = {}
    if (data.name !== undefined) updates.name = data.name
    if (data.icon !== undefined) updates.iconName = data.icon
    if (data.color !== undefined) updates.colorHex = data.color
    if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder
    if (data.countries !== undefined) updates.countries = data.countries

    const updated = await prisma.jobCategory.update({
      where: { id: params.id },
      data: updates,
    })

    await createAuditLog({
      session,
      action: 'UPDATE',
      targetTable: 'JobCategory',
      targetId: params.id,
      targetLabel: existing.name,
      oldValue: JSON.parse(JSON.stringify(existing)),
      newValue: JSON.parse(JSON.stringify(updated)),
      ipAddress: getIp(request),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (e) {
    console.error('Category update error:', e)
    return NextResponse.json({ success: false, error: 'Failed to update category' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    const existing = await prisma.jobCategory.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 })
    }

    await prisma.jobCategory.update({
      where: { id: params.id },
      data: { isActive: false },
    })

    await createAuditLog({
      session,
      action: 'DELETE',
      targetTable: 'JobCategory',
      targetId: params.id,
      targetLabel: existing.name,
      oldValue: JSON.parse(JSON.stringify(existing)),
      newValue: JSON.parse(JSON.stringify({ isActive: false })),
      ipAddress: getIp(request),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Category delete error:', e)
    return NextResponse.json({ success: false, error: 'Failed to delete category' }, { status: 500 })
  }
}
