import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/crm/rate-limit'

const CACHE_TTL_SECONDS = 300

function getCacheControl(maxAge = CACHE_TTL_SECONDS) {
  return `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`
}

async function getCustomerRegistrationsByDay(province: string | null | undefined, since: Date): Promise<Array<{ date: string; count: number }>> {
  try {
    const result = province
      ? await prisma.$queryRaw`SELECT DATE(created_at) as date, COUNT(*) as count FROM "CustomerProfile" WHERE created_at >= ${since} AND province = ${province} GROUP BY DATE(created_at) ORDER BY date ASC`
      : await prisma.$queryRaw`SELECT DATE(created_at) as date, COUNT(*) as count FROM "CustomerProfile" WHERE created_at >= ${since} GROUP BY DATE(created_at) ORDER BY date ASC`
    
    return (result as Array<{ date: Date; count: bigint }>).map(r => ({
      date: r.date.toISOString().split('T')[0],
      count: Number(r.count),
    }))
  } catch (e) {
    console.error('Failed to get registration by day:', e)
    return []
  }
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

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || request.headers.get('x-real-ip') 
      || 'unknown'
    
    const rateLimit = await checkRateLimit(clientIp, 'IP', '/api/crm/stats', 'GET', 'default')
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const isSuperAdmin = session.role === 'SUPER_ADMIN'
    const isProvinceAdmin = session.role === 'PROVINCE_ADMIN'
    const adminProvince = session.province

    const customerWhere = isSuperAdmin 
      ? {} 
      : isProvinceAdmin && adminProvince 
        ? { province: adminProvince }
        : { province: null }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalCustomersCount,
      activeCustomersCount,
      inactiveCustomersCount,
      blacklistedCustomersCount,
      regularCustomersCount,
      vipCustomersCount,
      corporateCustomersCount,
      potentialCustomersCount,
      newCustomersThisMonthCount,
      newCustomersLastMonthCount,
    ] = await Promise.all([
      prisma.customerProfile.count({ where: customerWhere }),
      prisma.customerProfile.count({ where: { ...customerWhere, status: 'ACTIVE' } }),
      prisma.customerProfile.count({ where: { ...customerWhere, status: 'INACTIVE' } }),
      prisma.customerProfile.count({ where: { ...customerWhere, status: 'BLACKLISTED' } }),
      prisma.customerProfile.count({ where: { ...customerWhere, customerType: 'REGULAR' } }),
      prisma.customerProfile.count({ where: { ...customerWhere, customerType: 'VIP' } }),
      prisma.customerProfile.count({ where: { ...customerWhere, customerType: 'CORPORATE' } }),
      prisma.customerProfile.count({ where: { ...customerWhere, customerType: 'POTENTIAL' } }),
      prisma.customerProfile.count({ where: { ...customerWhere, createdAt: { gte: startOfMonth } } }),
      prisma.customerProfile.count({ 
        where: { 
          ...customerWhere, 
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } 
        } 
      }),
    ])

    const customerGrowth = newCustomersLastMonthCount > 0
      ? ((newCustomersThisMonthCount - newCustomersLastMonthCount) / newCustomersLastMonthCount) * 100
      : newCustomersThisMonthCount > 0 ? 100 : 0

    const [
      allBookings,
      repeatCustomers,
      topCustomersData,
      customersByProvinceData,
      recentSignupsData,
      topTagsData,
    ] = await Promise.all([
      prisma.booking.findMany({
        where: {},
        select: { totalPrice: true },
      }),
      prisma.customerProfile.findMany({
        where: { ...customerWhere, totalBookings: { gt: 1 } },
        select: { id: true },
      }),
      prisma.customerProfile.findMany({
        where: customerWhere,
        orderBy: { totalSpent: 'desc' },
        take: 10,
        select: {
          id: true,
          userId: true,
          totalSpent: true,
          totalBookings: true,
          user: { select: { name: true } },
        },
      }),
      isSuperAdmin 
        ? prisma.customerProfile.groupBy({
            by: ['province'],
            where: { province: { not: null } },
            _count: { id: true },
            _sum: { totalSpent: true },
          })
        : Promise.resolve([]),
      prisma.customerProfile.findMany({
        where: customerWhere,
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.customerTag.findMany({
        orderBy: { usageCount: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          color: true,
          usageCount: true,
        },
      }),
    ])

    const totalBookingsCount = allBookings.length
    const totalRevenue = allBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0)
    const repeatCustomersCount = repeatCustomers.length
    
    const avgBookingsPerCustomer = totalCustomersCount > 0 
      ? totalBookingsCount / totalCustomersCount 
      : 0
    const repeatCustomerRate = totalCustomersCount > 0 
      ? (repeatCustomersCount / totalCustomersCount) * 100 
      : 0
    const avgRevenuePerCustomer = totalCustomersCount > 0 
      ? totalRevenue / totalCustomersCount 
      : 0

    const topCustomers = topCustomersData.map(c => ({
      id: c.id,
      name: c.user.name || 'Unknown',
      totalSpent: c.totalSpent,
      totalBookings: c.totalBookings,
    }))

    const customersByProvince = customersByProvinceData
      .filter(p => p.province)
      .map(p => ({
        province: p.province!,
        count: p._count.id,
        revenue: p._sum?.totalSpent || 0,
      }))

    const recentSignups = recentSignupsData.map(c => ({
      id: c.id,
      name: c.user.name || 'Unknown',
      email: c.user.email || '',
      createdAt: c.createdAt,
    }))

    let totalCommunications = 0
    let whatsappCount = 0
    let smsCount = 0
    let emailCount = 0

    if (totalCustomersCount > 0) {
      const [
        commCount,
        wc,
        sc,
        ec,
      ] = await Promise.all([
        prisma.customerCommunication.count(),
        prisma.customerCommunication.count({ where: { channel: 'WHATSAPP' } }),
        prisma.customerCommunication.count({ where: { channel: 'SMS' } }),
        prisma.customerCommunication.count({ where: { channel: 'EMAIL' } }),
      ])
      totalCommunications = commCount
      whatsappCount = wc
      smsCount = sc
      emailCount = ec
    }

    const topTags = topTagsData.map(t => ({
      id: t.id,
      name: t.name,
      color: t.color,
      usageCount: t.usageCount,
    }))

    const customerRegistrationsByDay = await getCustomerRegistrationsByDay(customerWhere.province, thirtyDaysAgo)

    const response = NextResponse.json({
      totalCustomers: totalCustomersCount,
      newCustomersThisMonth: newCustomersThisMonthCount,
      newCustomersLastMonth: newCustomersLastMonthCount,
      customerGrowth,
      activeCustomers: activeCustomersCount,
      inactiveCustomers: inactiveCustomersCount,
      blacklistedCustomers: blacklistedCustomersCount,
      regularCustomers: regularCustomersCount,
      vipCustomers: vipCustomersCount,
      corporateCustomers: corporateCustomersCount,
      potentialCustomers: potentialCustomersCount,
      avgBookingsPerCustomer: Math.round(avgBookingsPerCustomer * 100) / 100,
      repeatCustomerRate: Math.round(repeatCustomerRate * 100) / 100,
      avgCustomerLifetime: 0,
      totalRevenue,
      avgRevenuePerCustomer: Math.round(avgRevenuePerCustomer * 100) / 100,
      topCustomers,
      customersByProvince,
      recentSignups,
      totalCommunications,
      whatsappMessages: whatsappCount,
      smsMessages: smsCount,
      emailMessages: emailCount,
      topTags,
      customerRegistrationsByDay,
    })

    response.headers.set('Cache-Control', getCacheControl())
    response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)

    return response
  } catch (error) {
    console.error('CRM Stats API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch CRM statistics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}