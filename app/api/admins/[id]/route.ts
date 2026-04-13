import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { logActivity } from '@/lib/activity-log'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession(request)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'SUPER_ADMIN' && session.id !== params.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await prisma.admin.findUnique({
      where: { id: params.id },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            location: true
          }
        }
      }
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    const safeAdmin = {
      ...admin,
      password: undefined
    }

    return NextResponse.json(safeAdmin)
  } catch (error) {
    console.error('Error fetching admin:', error)
    return NextResponse.json({ error: 'Failed to fetch admin' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession(request)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, email, password, role, branchId, isActive, canEditServices } = body

    const isUpdatingSelf = session.id === params.id
    const isSuper = session.role === 'SUPER_ADMIN'

    if (!isSuper && !isUpdatingSelf) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (role && !['SUPER_ADMIN', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    if (role === 'ADMIN' && !branchId && !isSuper) {
      return NextResponse.json({ error: 'Branch is required for admin users' }, { status: 400 })
    }

    const updateData: any = {}

    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10)
      updateData.password = hashedPassword
    }
    if (isSuper && role !== undefined) updateData.role = role
    if (isSuper && branchId !== undefined) updateData.branchId = branchId
    if (isSuper && isActive !== undefined) updateData.isActive = isActive
    if (isSuper && canEditServices !== undefined) updateData.canEditServices = canEditServices

    const admin = await prisma.admin.update({
      where: { id: params.id },
      data: updateData,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            location: true
          }
        }
      }
    })

    await logActivity({
      adminId: session.id,
      adminEmail: session.email,
      adminName: session.name,
      action: 'UPDATE',
      entityType: 'ADMIN',
      entityId: admin.id,
      description: `Updated admin "${admin.name || admin.email}"`,
      details: { updatedFields: Object.keys(body) }
    })

    const safeAdmin = {
      ...admin,
      password: undefined
    }

    return NextResponse.json(safeAdmin)
  } catch (error) {
    console.error('Error updating admin:', error)
    return NextResponse.json({ error: 'Failed to update admin' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession(request)
    
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - Super Admin only' }, { status: 401 })
    }

    if (session.id === params.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    const admin = await prisma.admin.findUnique({
      where: { id: params.id }
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    await prisma.admin.delete({
      where: { id: params.id }
    })

    await logActivity({
      adminId: session.id,
      adminEmail: session.email,
      adminName: session.name,
      action: 'DELETE',
      entityType: 'ADMIN',
      entityId: params.id,
      description: `Deleted admin "${admin.name || admin.email}"`,
      details: { email: admin.email, role: admin.role }
    })

    return NextResponse.json({ message: 'Admin deleted successfully' })
  } catch (error) {
    console.error('Error deleting admin:', error)
    return NextResponse.json({ error: 'Failed to delete admin' }, { status: 500 })
  }
}
