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
  branchIds?: string[] | null
  region?: string | null
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

  // Branch scoping precedence: explicit branch set > single branch > region fallback.
  // Exactly one branchId condition is ever applied, so a branch filter can never be
  // overwritten by a later one. An explicitly passed empty set matches nothing.
  if (options?.branchIds) {
    where.branchId = { in: options.branchIds }
  } else if (options?.branchId) {
    where.branchId = options.branchId
  } else if (options?.region) {
    const regionBranchIds = await prisma.branch.findMany({
      where: { region: options.region },
      select: { id: true }
    }).then(branches => branches.map(b => b.id))
    if (regionBranchIds.length > 0) {
      where.branchId = { in: regionBranchIds }
    }
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

export async function getStatsForPeriod(
  startDate: Date,
  endDate: Date,
  branchId?: string | null,
  region?: string | null,
  branchIds?: string[] | null
) {
  // Branch scoping precedence: explicit branch set > single branch > region fallback.
  // The branch filter is applied at most once per where-clause, so a region lookup can
  // never overwrite an already-applied branch condition.
  const hasBranchScope = Boolean(branchIds) || Boolean(branchId)

  const applyBranchScope = (where: any) => {
    if (branchIds) where.branchId = { in: branchIds }
    else if (branchId) where.branchId = branchId
  }

  const regionBranchIds = !hasBranchScope && region
    ? await prisma.branch.findMany({ where: { region }, select: { id: true } }).then(b => b.map(x => x.id))
    : null
  const regionBranchFilter = regionBranchIds && regionBranchIds.length > 0 ? regionBranchIds : null

  const bookingWhere: any = {
    createdAt: { gte: startDate, lte: endDate },
  }
  applyBranchScope(bookingWhere)
  if (!hasBranchScope && region) bookingWhere.region = region

  const appWhere: any = {
    createdAt: { gte: startDate, lte: endDate },
  }
  applyBranchScope(appWhere)
  if (!hasBranchScope && regionBranchFilter) appWhere.branchId = { in: regionBranchFilter }

  const activityWhere: any = {
    createdAt: { gte: startDate, lte: endDate },
  }
  applyBranchScope(activityWhere)
  if (!hasBranchScope && regionBranchFilter) activityWhere.branchId = { in: regionBranchFilter }

  const [
    bookingStats,
    applicationStats,
    activityStats
  ] = await Promise.all([
    prisma.booking.groupBy({
      by: ['status'],
      _count: true,
      where: bookingWhere
    }),
    prisma.application.groupBy({
      by: ['status'],
      _count: true,
      where: appWhere
    }),
    prisma.activityLog.groupBy({
      by: ['action'],
      _count: true,
      where: activityWhere
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
