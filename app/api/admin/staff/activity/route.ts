import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'staff:view',
      level: 'read',
    })
    if (!guard.ok) return guard.response

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - 7)
    const onlineThreshold = new Date(now.getTime() - 5 * 60 * 1000)

    const admins = await prisma.adminUser.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
      },
    })

    const adminIds = admins.map((a) => a.id)

    const [actionsToday, actionsThisWeek, lastActions] = await Promise.all([
      prisma.auditLog.groupBy({
        by: ['adminUserId'],
        where: {
          adminUserId: { in: adminIds },
          createdAt: { gte: todayStart },
        },
        _count: { id: true },
      }),
      prisma.auditLog.groupBy({
        by: ['adminUserId'],
        where: {
          adminUserId: { in: adminIds },
          createdAt: { gte: weekStart },
        },
        _count: { id: true },
      }),
      prisma.auditLog.findMany({
        where: { adminUserId: { in: adminIds } },
        orderBy: { createdAt: 'desc' },
        distinct: ['adminUserId'],
        select: {
          adminUserId: true,
          createdAt: true,
          action: true,
        },
      }),
    ])

    const kycActions = ['KYC_APPROVE', 'KYC_REJECT', 'KYC_REVIEW']
    const userActions = ['BAN', 'UNBAN', 'SUSPEND', 'UNSUSPEND', 'DELETE', 'UPDATE']
    const jobActions = ['JOB_APPROVE', 'JOB_REJECT', 'JOB_CLOSE', 'DISPUTE_RESOLVE']

    const [kycCounts, userCounts, jobCounts] = await Promise.all([
      prisma.auditLog.groupBy({
        by: ['adminUserId'],
        where: {
          adminUserId: { in: adminIds },
          createdAt: { gte: todayStart },
          action: { in: kycActions },
        },
        _count: { id: true },
      }),
      prisma.auditLog.groupBy({
        by: ['adminUserId'],
        where: {
          adminUserId: { in: adminIds },
          createdAt: { gte: todayStart },
          action: { in: userActions },
        },
        _count: { id: true },
      }),
      prisma.auditLog.groupBy({
        by: ['adminUserId'],
        where: {
          adminUserId: { in: adminIds },
          createdAt: { gte: todayStart },
          action: { in: jobActions },
        },
        _count: { id: true },
      }),
    ])

    const todayMap = new Map(actionsToday.map((a) => [a.adminUserId, a._count.id]))
    const weekMap = new Map(actionsThisWeek.map((a) => [a.adminUserId, a._count.id]))
    const lastActionMap = new Map(lastActions.map((a) => [a.adminUserId, a]))
    const kycMap = new Map(kycCounts.map((a) => [a.adminUserId, a._count.id]))
    const userMap = new Map(userCounts.map((a) => [a.adminUserId, a._count.id]))
    const jobMap = new Map(jobCounts.map((a) => [a.adminUserId, a._count.id]))

    const staff = admins.map((admin) => {
      const lastAction = lastActionMap.get(admin.id)
      const lastActiveAt = lastAction?.createdAt || admin.lastLoginAt
      const isOnline = lastActiveAt ? new Date(lastActiveAt) >= onlineThreshold : false

      return {
        id: admin.id,
        name: `${admin.firstName} ${admin.lastName}`,
        email: admin.email,
        role: admin.role,
        isActive: admin.isActive,
        lastLoginAt: admin.lastLoginAt?.toISOString() || null,
        actionsToday: todayMap.get(admin.id) || 0,
        actionsThisWeek: weekMap.get(admin.id) || 0,
        lastActiveAt: lastActiveAt?.toISOString() || null,
        isOnline,
        actionBreakdown: {
          kycReviews: kycMap.get(admin.id) || 0,
          userActions: userMap.get(admin.id) || 0,
          jobActions: jobMap.get(admin.id) || 0,
        },
      }
    })

    staff.sort((a, b) => b.actionsToday - a.actionsToday)

    const recentLogs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        adminUserId: true,
        adminEmail: true,
        adminRole: true,
        action: true,
        targetTable: true,
        targetId: true,
        targetLabel: true,
        ipAddress: true,
        createdAt: true,
      },
    })

    const adminNameMap = new Map(
      admins.map((a) => [a.id, `${a.firstName} ${a.lastName}`])
    )

    const recentActivity = recentLogs.map((log) => ({
      id: log.id,
      adminUserId: log.adminUserId,
      adminEmail: log.adminEmail,
      adminName: adminNameMap.get(log.adminUserId) || log.adminEmail,
      adminRole: log.adminRole,
      action: log.action,
      targetTable: log.targetTable,
      targetId: log.targetId,
      targetLabel: log.targetLabel,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt.toISOString(),
    }))

    const totalToday = staff.reduce((sum, s) => sum + s.actionsToday, 0)
    const totalWeek = staff.reduce((sum, s) => sum + s.actionsThisWeek, 0)
    const onlineNow = staff.filter((s) => s.isOnline).length

    return NextResponse.json({
      staff,
      recentActivity,
      summary: {
        totalStaff: staff.length,
        onlineNow,
        actionsToday: totalToday,
        actionsThisWeek: totalWeek,
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Staff activity GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch staff activity' }, { status: 500 })
  }
}
