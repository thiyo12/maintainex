import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  getCrmCountryFilter,
  guardCrmRequest,
} from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'

const VALID_USER_TYPES = new Set(['TASKER', 'CUSTOMER', 'COMPANY'])
const VALID_REVIEW_STATUSES = new Set(['CONFIRMED', 'DISMISSED'])
const VALID_ACTIONS = new Set(['BAN', 'WARNING', 'NO_ACTION'])

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'cheating:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const status = (searchParams.get('status') || '').toUpperCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit

    if (status && !['PENDING', 'CONFIRMED', 'DISMISSED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const where: any = { ...getCrmCountryFilter(security) }
    if (status) where.status = status

    const [reports, total, pendingCount, confirmedCount] = await Promise.all([
      prisma.offPlatformDeal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.offPlatformDeal.count({ where }),
      prisma.offPlatformDeal.count({
        where: { status: 'PENDING', ...getCrmCountryFilter(security) },
      }),
      prisma.offPlatformDeal.count({
        where: { status: 'CONFIRMED', ...getCrmCountryFilter(security) },
      }),
    ])

    return NextResponse.json(
      {
        reports,
        summary: { pending: pendingCount, confirmed: confirmedCount, total },
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM cheating GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'cheating:action',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const reporterId = typeof body?.reporterId === 'string' ? body.reporterId : ''
    const againstUserId = typeof body?.againstUserId === 'string' ? body.againstUserId : ''
    const againstUserType = typeof body?.againstUserType === 'string'
      ? body.againstUserType.toUpperCase()
      : 'TASKER'
    const jobId = typeof body?.jobId === 'string' ? body.jobId : undefined
    const evidence = typeof body?.evidence === 'string' ? body.evidence.trim().slice(0, 5000) : ''
    const evidenceUrls = Array.isArray(body?.evidenceUrls)
      ? body.evidenceUrls.filter((value: unknown): value is string => typeof value === 'string').slice(0, 20)
      : []

    if (!reporterId || !againstUserId || evidence.length < 3 || !VALID_USER_TYPES.has(againstUserType)) {
      return NextResponse.json({ error: 'Invalid report payload' }, { status: 400 })
    }

    const [reporter, againstUser, job] = await Promise.all([
      prisma.user.findUnique({
        where: { id: reporterId },
        select: { id: true, countryCode: true },
      }),
      prisma.user.findUnique({
        where: { id: againstUserId },
        select: { id: true, name: true, countryCode: true },
      }),
      jobId
        ? prisma.marketplaceJob.findUnique({
            where: { id: jobId },
            select: { id: true, countryCode: true },
          })
        : Promise.resolve(null),
    ])

    if (!reporter || !againstUser) {
      return NextResponse.json({ error: 'Reporter or reported user not found' }, { status: 404 })
    }

    if (reporter.countryCode !== againstUser.countryCode) {
      return NextResponse.json({ error: 'Cross-country report payload rejected' }, { status: 400 })
    }
    if (job && job.countryCode !== againstUser.countryCode) {
      return NextResponse.json({ error: 'Job country does not match reported user' }, { status: 400 })
    }
    if (!assertCrmCountryAllowed(security, againstUser.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const report = await prisma.offPlatformDeal.create({
      data: {
        reporterId,
        againstUserId,
        againstUserType,
        jobId,
        evidence,
        evidenceUrls: evidenceUrls.length ? JSON.stringify(evidenceUrls) : null,
        status: 'PENDING',
        countryCode: againstUser.countryCode,
      },
    })

    await createAuditLog({
      action: 'CREATE',
      category: 'TRUST',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'OffPlatformDeal',
      entityId: report.id,
      entityName: againstUser.name,
      description: 'CRM off-platform report created',
      newValue: { againstUserId, againstUserType, jobId, countryCode: againstUser.countryCode },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'MEDIUM',
    })

    return NextResponse.json({ report }, { status: 201 })
  } catch (error) {
    console.error('CRM cheating POST error:', error)
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'cheating:action',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const reportId = typeof body?.reportId === 'string' ? body.reportId : ''
    const status = typeof body?.status === 'string' ? body.status.toUpperCase() : ''
    const action = typeof body?.action === 'string' ? body.action.toUpperCase() : 'NO_ACTION'
    const actionNote = typeof body?.actionNote === 'string' ? body.actionNote.trim().slice(0, 2000) : null

    if (!reportId || !VALID_REVIEW_STATUSES.has(status) || !VALID_ACTIONS.has(action)) {
      return NextResponse.json({ error: 'Invalid review payload' }, { status: 400 })
    }
    if (status === 'CONFIRMED' && action === 'BAN' && !actionNote) {
      return NextResponse.json({ error: 'A reason is required before banning an account' }, { status: 400 })
    }

    const existing = await prisma.offPlatformDeal.findUnique({ where: { id: reportId } })
    if (!existing) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }
    if (!assertCrmCountryAllowed(security, existing.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (existing.status !== 'PENDING' || existing.reviewedAt) {
      return NextResponse.json({ error: 'Report has already been reviewed' }, { status: 409 })
    }

    const target = await prisma.user.findUnique({
      where: { id: existing.againstUserId },
      select: { id: true, name: true, countryCode: true, isBanned: true, banReason: true },
    })
    if (!target) {
      return NextResponse.json({ error: 'Reported user no longer exists' }, { status: 404 })
    }
    if (!assertCrmCountryAllowed(security, target.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const resolvedAction = status === 'CONFIRMED' ? action : 'NO_ACTION'

    const report = await prisma.$transaction(async tx => {
      const claimed = await tx.offPlatformDeal.updateMany({
        where: {
          id: reportId,
          status: 'PENDING',
          reviewedAt: null,
        },
        data: {
          status,
          action: resolvedAction,
          actionNote,
          reviewedBy: security.adminId,
          reviewedAt: new Date(),
        },
      })
      if (claimed.count !== 1) {
        throw new Error('REPORT_ALREADY_REVIEWED')
      }

      const updated = await tx.offPlatformDeal.findUniqueOrThrow({
        where: { id: reportId },
      })

      if (status === 'CONFIRMED' && resolvedAction === 'BAN') {
        await tx.user.update({
          where: { id: target.id },
          data: {
            isBanned: true,
            isActive: false,
            banReason: target.isBanned && target.banReason
              ? target.banReason
              : `Off-platform deal confirmed: ${actionNote}`,
          },
        })
      }

      return updated
    })

    await createAuditLog({

      action: 'UPDATE',
      category: 'TRUST',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'OffPlatformDeal',
      entityId: report.id,
      entityName: target.name,
      description: `CRM off-platform report reviewed: ${status} / ${resolvedAction}`,
      oldValue: {
        status: existing.status,
        action: existing.action,
        reviewedBy: existing.reviewedBy,
        targetBanned: target.isBanned,
      },
      newValue: {
        status,
        action: resolvedAction,
        actionNote,
        reviewedBy: security.adminId,
        targetBanned: status === 'CONFIRMED' && resolvedAction === 'BAN' ? true : target.isBanned,
      },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: resolvedAction === 'BAN' ? 'HIGH' : 'MEDIUM',
    })

    return NextResponse.json({ report })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'REPORT_ALREADY_REVIEWED') {
      return NextResponse.json({ error: 'Report has already been reviewed' }, { status: 409 })
    }
    console.error('CRM cheating PUT error:', error)
    return NextResponse.json({ error: 'Failed to review report' }, { status: 500 })
  }
}
