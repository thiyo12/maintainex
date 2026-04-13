import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
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

    const { searchParams } = new URL(request.url)
    const includeAdmins = searchParams.get('includeAdmins') === 'true'

    const branch = await prisma.branch.findUnique({
      where: { id: params.id },
      include: {
        ...(includeAdmins && {
          admins: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
              createdAt: true
            }
          }
        }),
        _count: {
          select: {
            admins: true,
            bookings: true,
            applications: true,
            services: true
          }
        }
      }
    })

    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    if (session.role !== 'SUPER_ADMIN' && session.branchId !== params.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(branch)
  } catch (error) {
    console.error('Error fetching branch:', error)
    return NextResponse.json({ error: 'Failed to fetch branch' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession(request)
    
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - Super Admin only' }, { status: 401 })
    }

    const body = await request.json()
    const { name, location, phone, email, address, isActive } = body

    const branch = await prisma.branch.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(location && { location }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(isActive !== undefined && { isActive })
      }
    })

    await logActivity({
      adminId: session.id,
      adminEmail: session.email,
      adminName: session.name,
      action: 'UPDATE',
      entityType: 'BRANCH',
      entityId: branch.id,
      description: `Updated branch "${branch.name}"`,
      details: { name, location, isActive }
    })

    return NextResponse.json(branch)
  } catch (error) {
    console.error('Error updating branch:', error)
    return NextResponse.json({ error: 'Failed to update branch' }, { status: 500 })
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

    const branch = await prisma.branch.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            admins: true,
            bookings: true,
            applications: true
          }
        }
      }
    })

    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    if (branch._count.admins > 0 || branch._count.bookings > 0 || branch._count.applications > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete branch with existing data. Remove all related data first.' 
      }, { status: 400 })
    }

    await prisma.branch.delete({
      where: { id: params.id }
    })

    await logActivity({
      adminId: session.id,
      adminEmail: session.email,
      adminName: session.name,
      action: 'DELETE',
      entityType: 'BRANCH',
      entityId: params.id,
      description: `Deleted branch "${branch.name}"`,
      details: { name: branch.name, location: branch.location }
    })

    return NextResponse.json({ message: 'Branch deleted successfully' })
  } catch (error) {
    console.error('Error deleting branch:', error)
    return NextResponse.json({ error: 'Failed to delete branch' }, { status: 500 })
  }
}
