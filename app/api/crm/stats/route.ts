import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

const CACHE_TTL_SECONDS = 300

function getCacheControl(maxAge = CACHE_TTL_SECONDS) {
  return `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'ADMIN' && session.role !== 'PROVINCE_ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const isSuperAdmin = session.role === 'SUPER_ADMIN'
    const isProvinceAdmin = session.role === 'PROVINCE_ADMIN'
    const adminProvince = session.province

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

    let totalCustomers = 0
    let newCustomersThisMonth = 0
    let newCustomersLastMonth = 0
    let activeCustomers = 0
    let vipCustomers = 0
    let repeatCustomerRate = 0
    let avgRevenuePerCustomer = 0
    let totalRevenue = 0

    // Get counts from existing User and Booking tables (always available)
    try {
      const userCount = await prisma.user.count({ where: { role: 'CUSTOMER' } })
      totalCustomers = userCount
      newCustomersThisMonth = await prisma.user.count({ 
        where: { role: 'CUSTOMER', createdAt: { gte: startOfMonth } } 
      })
      newCustomersLastMonth = await prisma.user.count({ 
        where: { role: 'CUSTOMER', createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } 
      })
      activeCustomers = userCount
      
      const bookings = await prisma.booking.findMany({
        select: { totalPrice: true }
      })
      totalRevenue = bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0)
      avgRevenuePerCustomer = totalCustomers > 0 ? totalRevenue / totalCustomers : 0

      const repeatedUsers = await prisma.booking.groupBy({
        by: ['userId'],
        where: {},
        _count: { userId: true }
      })
      const repeatCount = repeatedUsers.filter(b => b._count.userId > 1).length
      repeatCustomerRate = totalCustomers > 0 ? (repeatCount / totalCustomers) * 100 : 0
    } catch (e) {
      console.error('Error fetching user counts:', e)
    }

    // Try to get CustomerProfile data if table exists
    let vipCustomersTry = 0
    try {
      vipCustomersTry = await prisma.customerProfile.count({ 
        where: { customerType: 'VIP' },
        take: 0
      })
      // This will throw if table doesn't exist
    } catch (e) {
      console.log('CustomerProfile table not available yet')
    }

    vipCustomers = vipCustomersTry || 0

    const customerGrowth = newCustomersLastMonth > 0
      ? ((newCustomersThisMonth - newCustomersLastMonth) / newCustomersLastMonth) * 100
      : newCustomersThisMonth > 0 ? 100 : 0

    // Get recent signups from existing User table
    let recentSignups: Array<{id: string, name: string, email: string, createdAt: Date}> = []
    try {
      const recent = await prisma.user.findMany({
        where: { role: 'CUSTOMER' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true
        }
      })
      recentSignups = recent as any
    } catch (e) {
      console.log('No recent signups')
    }

    // Get bookings that have user data
    let topCustomers: Array<{id: string, name: string, totalSpent: number, totalBookings: number}> = []
    try {
      const bookingsWithUsers = await prisma.booking.findMany({
        where: {},
        include: { user: true },
        orderBy: { totalPrice: 'desc' },
        take: 10
      })
      
      const customerSpending: Record<string, {name: string, totalSpent: number, totalBookings: number}> = {}
      bookingsWithUsers.forEach(b => {
        if (b.user) {
          const userId = b.userId
          if (!customerSpending[userId]) {
            customerSpending[userId] = { name: b.user.name || 'Unknown', totalSpent: 0, totalBookings: 0 }
          }
          customerSpending[userId].totalSpent += b.totalPrice || 0
          customerSpending[userId].totalBookings += 1
        }
      })
      topCustomers = Object.entries(customerSpending).map(([id, data]) => ({
        id,
        ...data
      })).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10)
    } catch (e) {
      console.log('No booking data')
    }

    // Build response
    const responseData = {
      totalCustomers,
      newCustomersThisMonth,
      newCustomersLastMonth,
      customerGrowth,
      activeCustomers,
      inactiveCustomers: 0,
      blacklistedCustomers: 0,
      regularCustomers: totalCustomers - vipCustomers,
      vipCustomers,
      corporateCustomers: 0,
      potentialCustomers: 0,
      avgBookingsPerCustomer: 0,
      repeatCustomerRate,
      avgRevenuePerCustomer,
      totalRevenue,
      topCustomers,
      customersByProvince: [] as Array<{province: string, count: number, revenue: number}>,
      recentSignups: recentSignups.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        createdAt: s.createdAt.toISOString()
      })),
      totalCommunications: 0,
      whatsappMessages: 0,
      smsMessages: 0,
      emailMessages: 0,
      topTags: [] as Array<{id: string, name: string, color: string, usageCount: number}>,
      customerRegistrationsByDay: [] as Array<{date: string, count: number}>
    }

    const response = NextResponse.json(responseData, {
      headers: {
        'Cache-Control': getCacheControl(),
      }
    })

    return response
  } catch (error: any) {
    console.error('CRM stats error:', error)
    return NextResponse.json({ 
      error: 'Failed to load CRM stats',
      details: error.message 
    }, { status: 500 })
  }
}