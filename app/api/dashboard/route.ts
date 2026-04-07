import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, isSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const userBranchId = user.branchId
    const isSuper = isSuperAdmin(session)

    const branchFilter = !isSuper && userBranchId ? { branchId: userBranchId } : {}

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
      prisma.service.count({ where: !isSuper && userBranchId ? { branchId: userBranchId } : {} })
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
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
