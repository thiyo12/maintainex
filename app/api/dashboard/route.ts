import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role === 'CUSTOMER') {
      return getCustomerDashboard(session)
    } else if (session.role === 'TASKER') {
      return getTaskerDashboard(session)
    } else {
      return getAdminDashboard(session)
    }
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 })
  }
}

async function getCustomerDashboard(session: { id: string }) {
  const customer = await prisma.customerProfile.findUnique({
    where: { userId: session.id },
  })

  if (!customer) {
    return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 })
  }

  const [
    activeBookings,
    activeTasks,
    completedTasks,
    totalSpent,
    recentTasks,
    recentBookings,
    unreadNotifications,
  ] = await Promise.all([
    prisma.booking.count({
      where: { userId: session.id, status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] } }
    }),
    prisma.task.count({
      where: { customerId: customer.id, status: { in: ['PENDING_REVIEW', 'APPROVED', 'OPEN', 'IN_PROGRESS'] } }
    }),
    prisma.task.count({
      where: { customerId: customer.id, status: 'COMPLETED' }
    }),
    prisma.booking.aggregate({
      where: { userId: session.id, status: 'COMPLETED' },
      _sum: { totalPrice: true },
    }),
    prisma.task.findMany({
      where: { customerId: customer.id },
      include: { category: true, assignment: { include: { tasker: { include: { user: { select: { name: true } } } } } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.booking.findMany({
      where: { userId: session.id },
      include: { service: { include: { category: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.notification.count({
      where: { userId: session.id, isRead: false },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      stats: {
        activeBookings,
        activeTasks,
        completedTasks,
        totalSpent: totalSpent._sum.totalPrice || 0,
        walletBalance: customer.walletBalance,
      },
      recentTasks,
      recentBookings,
      unreadNotifications,
      profile: customer,
    }
  })
}

async function getTaskerDashboard(session: { id: string }) {
  const tasker = await prisma.taskerProfile.findUnique({
    where: { userId: session.id },
  })

  if (!tasker) {
    return NextResponse.json({ error: 'Tasker profile not found' }, { status: 404 })
  }

  const [
    pendingApplications,
    activeAssignments,
    completedTasks,
    totalEarnings,
    availableJobs,
    recentAssignments,
    unreadNotifications,
  ] = await Promise.all([
    prisma.taskApplication.count({
      where: { taskerId: tasker.id, status: 'PENDING' }
    }),
    prisma.taskAssignment.count({
      where: { taskerId: tasker.id, status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] } }
    }),
    prisma.taskAssignment.count({
      where: { taskerId: tasker.id, status: 'COMPLETED' }
    }),
    prisma.payment.aggregate({
      where: { taskerId: tasker.id, status: { in: ['COMPLETED', 'RELEASED'] } },
      _sum: { taskerPayout: true },
    }),
    prisma.task.count({
      where: { status: 'OPEN' }
    }),
    prisma.taskAssignment.findMany({
      where: { taskerId: tasker.id },
      include: {
        task: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.notification.count({
      where: { userId: session.id, isRead: false },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      stats: {
        pendingApplications,
        activeAssignments,
        completedTasks,
        totalEarnings: totalEarnings._sum.taskerPayout || 0,
        availableJobs,
        rating: tasker.overallRating,
        totalReviews: tasker.totalReviews,
        isAvailable: tasker.isAvailable,
      },
      recentAssignments,
      unreadNotifications,
      profile: tasker,
    }
  })
}

async function getAdminDashboard(session: { id: string }) {
  const [
    totalUsers,
    totalCustomers,
    totalTaskers,
    totalBookings,
    totalTasks,
    pendingTasks,
    pendingApplications,
    activeAssignments,
    totalRevenue,
    pendingPayments,
    recentBookings,
    recentTasks,
    reviews,
  ] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: 'CUSTOMER', isActive: true } }),
    prisma.user.count({ where: { role: 'TASKER', isActive: true } }),
    prisma.booking.count(),
    prisma.task.count(),
    prisma.task.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.taskApplication.count({ where: { status: 'PENDING' } }),
    prisma.taskAssignment.count({ where: { status: { in: ['CONFIRMED', 'IN_PROGRESS'] } } }),
    prisma.payment.aggregate({
      where: { status: { in: ['COMPLETED', 'RELEASED'] } },
      _sum: { amount: true },
    }),
    prisma.payment.count({ where: { status: 'PENDING' } }),
    prisma.booking.findMany({
      include: { service: { include: { category: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.task.findMany({
      include: { category: true, customer: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.review.count(),
  ])

  return NextResponse.json({
    success: true,
    data: {
      stats: {
        totalUsers,
        totalCustomers,
        totalTaskers,
        totalBookings,
        totalTasks,
        pendingTasks,
        pendingApplications,
        activeAssignments,
        totalRevenue: totalRevenue._sum.amount || 0,
        pendingPayments,
        reviews,
      },
      recentBookings,
      recentTasks,
    }
  })
}
