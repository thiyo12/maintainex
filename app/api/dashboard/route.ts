import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('Dashboard API called by:', session.email, 'role:', session.role)

    const userBranchId = session.branchId || null
    const isSuper = session.role === 'SUPER_ADMIN'

    const branchFilter = !isSuper && userBranchId ? { branchId: userBranchId } : {}
    const serviceFilter = !isSuper && userBranchId ? { branchId: userBranchId } : {}

    const [
      totalBookings,
      pendingBookings,
      totalApplications,
      newApplications,
      totalServices
    ] = await Promise.all([
      prisma.booking.count({ where: branchFilter }),
      prisma.booking.count({ where: { ...branchFilter, status: 'PENDING' } }),
      prisma.application.count({ where: branchFilter }),
      prisma.application.count({ where: { ...branchFilter, status: 'NEW' } }),
      prisma.service.count({ where: serviceFilter })
    ])

    const recentBookings = await prisma.booking.findMany({
      where: branchFilter,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { service: true }
    })

    const recentApplications = await prisma.application.findMany({
      where: branchFilter,
      take: 5,
      orderBy: { createdAt: 'desc' }
    })

    const branches = isSuper ? await prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true, location: true }
    }) : []

    return NextResponse.json({
      stats: {
        totalBookings,
        pendingBookings,
        totalApplications,
        newApplications,
        totalServices
      },
      recentBookings,
      recentApplications,
      branches,
      currentBranch: userBranchId,
      isSuperAdmin: isSuper
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
