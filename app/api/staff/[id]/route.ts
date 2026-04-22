import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isSuper = session.role === 'SUPER_ADMIN'
    const canManage = session.role === 'SUPER_ADMIN' || session.role === 'ADMIN'

    if (!canManage) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // Check if staff belongs to branch
    const staff = await prisma.staff.findUnique({
      where: { id: params.id }
    })

    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    // Branch admin can only delete their branch's staff
    if (!isSuper && session.branchId && staff.branchId !== session.branchId) {
      return NextResponse.json({ error: 'Cannot delete staff from other branch' }, { status: 403 })
    }

    await prisma.staff.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Staff DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isSuper = session.role === 'SUPER_ADMIN'
    const canManage = session.role === 'SUPER_ADMIN' || session.role === 'ADMIN'

    if (!canManage) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const { name, phone, email, position, photo, isActive, branchId } = body

    // Check if staff belongs to branch
    const existing = await prisma.staff.findUnique({
      where: { id: params.id }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    // Branch admin can only update their branch's staff
    if (!isSuper && session.branchId && existing.branchId !== session.branchId) {
      return NextResponse.json({ error: 'Cannot update staff from other branch' }, { status: 403 })
    }

    // Determine branchId
    let updateBranchId = branchId || existing.branchId
    if (!isSuper && session.branchId) {
      updateBranchId = session.branchId
    }

    const staff = await prisma.staff.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(position !== undefined && { position }),
        ...(photo !== undefined && { photo }),
        ...(isActive !== undefined && { isActive }),
        ...(updateBranchId && isSuper && { branchId: updateBranchId })
      },
      include: { branch: true }
    })

    return NextResponse.json(staff)
  } catch (error) {
    console.error('Staff PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 })
  }
}