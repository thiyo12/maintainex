import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')
    const isSuper = session.role === 'SUPER_ADMIN'

    let where: any = {}
    
    // Branch admin can only see their branch
    if (!isSuper && session.branchId) {
      where.branchId = session.branchId
    } else if (branchId && isSuper) {
      where.branchId = branchId
    }

    const staff = await prisma.staff.findMany({
      where,
      include: { branch: true },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(staff)
  } catch (error) {
    console.error('Staff GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
    const { name, phone, email, position, photo, branchId } = body

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: 'Name is required (at least 2 characters)' }, { status: 400 })
    }

    // Generate staff ID
    const lastStaff = await prisma.staff.findFirst({
      orderBy: { createdAt: 'desc' }
    })
    
    let newStaffId = 'EMP-001'
    if (lastStaff?.staffId) {
      const lastNum = parseInt(lastStaff.staffId.replace('EMP-', ''))
      newStaffId = `EMP-${String(lastNum + 1).padStart(3, '0')}`
    }

    // Determine branchId
    let staffBranchId = branchId
    if (!isSuper && session.branchId) {
      staffBranchId = session.branchId
    }

    const staff = await prisma.staff.create({
      data: {
        staffId: newStaffId,
        name,
        phone,
        email,
        position,
        photo,
        branchId: staffBranchId,
        isActive: true
      },
      include: { branch: true }
    })

    return NextResponse.json(staff, { status: 201 })
  } catch (error) {
    console.error('Staff POST error:', error)
    return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 })
  }
}