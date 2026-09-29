import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth/authentication/auth-utils'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isSuper = session.role === 'SUPER_ADMIN'
    const canManage = ['SUPER_ADMIN', 'MANAGER', 'FINANCE'].includes(session.role)

    if (!canManage) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    await prisma.jobVacancy.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Vacancy DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete vacancy' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isSuper = session.role === 'SUPER_ADMIN'
    const canManage = ['SUPER_ADMIN', 'MANAGER', 'FINANCE'].includes(session.role)

    if (!canManage) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, location, isActive, branchId } = body

    const vacancy = await prisma.jobVacancy.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(location !== undefined && { location }),
        ...(isActive !== undefined && { isActive }),
        ...(branchId && isSuper && { branchId })
      }
    })

    return NextResponse.json(vacancy)
  } catch (error) {
    console.error('Vacancy PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update vacancy' }, { status: 500 })
  }
}