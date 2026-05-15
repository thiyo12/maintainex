'use server'

import { prisma } from './prisma'
import { headers } from 'next/headers'

export type ActionType = 
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'VIEW'
  | 'LOGIN'
  | 'LOGOUT'
  | 'STATUS_CHANGE'
  | 'EXPORT'

export type EntityType = 
  | 'BOOKING'
  | 'APPLICATION'
  | 'SERVICE'
  | 'CATEGORY'
  | 'SETTINGS'
  | 'ADMIN'
  | 'AUTH'
  | 'BRANCH'

interface LogActivityParams {
  adminId: string
  adminEmail: string
  adminName?: string | null
  branchId?: string | null
  action: ActionType
  entityType: EntityType
  entityId?: string
  description: string
  details?: Record<string, any>
}

export async function logActivity(params: LogActivityParams) {
  try {
    const headersList = await headers()
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
    const userAgent = headersList.get('user-agent') || 'unknown'

    await prisma.activityLog.create({
      data: {
        adminId: params.adminId,
        adminEmail: params.adminEmail,
        adminName: params.adminName || null,
        branchId: params.branchId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        description: params.description,
        details: params.details ? JSON.stringify(params.details) : null,
        ipAddress,
        userAgent
      }
    })
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}

export async function getActivityLogs(options?: {
  adminId?: string
  action?: string
  entityType?: string
  branchId?: string | null
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}) {
  const where: any = {}

  if (options?.adminId) where.adminId = options.adminId
  if (options?.action) where.action = options.action
  if (options?.entityType) where.entityType = options.entityType
  if (options?.startDate || options?.endDate) {
    where.createdAt = {}
    if (options.startDate) where.createdAt.gte = options.startDate
    if (options.endDate) where.createdAt.lte = options.endDate
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0
    }),
    prisma.activityLog.count({ where })
  ])

  return { logs, total }
}

export async function getStatsForPeriod(startDate: Date, endDate: Date, branchId?: string | null) {
  const whereClause = {
    createdAt: { gte: startDate, lte: endDate },
    ...(branchId && { branchId })
  }

  const [
    bookingStats,
    applicationStats,
    activityStats
  ] = await Promise.all([
    prisma.booking.groupBy({
      by: ['status'],
      _count: true,
      where: whereClause
    }),
    prisma.application.groupBy({
      by: ['status'],
      _count: true,
      where: whereClause
    }),
    prisma.activityLog.groupBy({
      by: ['action'],
      _count: true,
      where: {
        createdAt: { gte: startDate, lte: endDate },
        ...(branchId ? { branchId } : {})
      }
    })
  ])

  const totalBookings = bookingStats.reduce((acc, curr) => acc + curr._count, 0)
  const totalApplications = applicationStats.reduce((acc, curr) => acc + curr._count, 0)

  return {
    bookings: {
      total: totalBookings,
      pending: bookingStats.find(b => b.status === 'PENDING')?._count || 0,
      confirmed: bookingStats.find(b => b.status === 'CONFIRMED')?._count || 0,
      inProgress: bookingStats.find(b => b.status === 'IN_PROGRESS')?._count || 0,
      completed: bookingStats.find(b => b.status === 'COMPLETED')?._count || 0,
      cancelled: bookingStats.find(b => b.status === 'CANCELLED')?._count || 0
    },
    applications: {
      total: totalApplications,
      new: applicationStats.find(a => a.status === 'NEW')?._count || 0,
      reviewed: applicationStats.find(a => a.status === 'REVIEWED')?._count || 0,
      interview: applicationStats.find(a => a.status === 'INTERVIEW')?._count || 0,
      hired: applicationStats.find(a => a.status === 'HIRED')?._count || 0,
      rejected: applicationStats.find(a => a.status === 'REJECTED')?._count || 0
    },
    adminActivity: {
      total: activityStats.reduce((acc, curr) => acc + curr._count, 0),
      logins: activityStats.find(a => a.action === 'LOGIN')?._count || 0,
      creates: activityStats.find(a => a.action === 'CREATE')?._count || 0,
      updates: activityStats.find(a => a.action === 'UPDATE')?._count || 0,
      deletes: activityStats.find(a => a.action === 'DELETE')?._count || 0,
      statusChanges: activityStats.find(a => a.action === 'STATUS_CHANGE')?._count || 0
    }
  }
}
