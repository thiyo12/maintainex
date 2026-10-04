import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  getCrmCountryCodes,
  guardCrmRequest,
} from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'

const REVIEW_STATUSES = new Set(['CONFIRMED', 'DISMISSED', 'REVIEWED', 'ESCALATED'])

function safeMetadata(raw: string | null) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'risk_events:read',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const status = request.nextUrl.searchParams.get('status') || 'pending'
    const severity = request.nextUrl.searchParams.get('severity')?.trim().toUpperCase() || ''
    const signalType = request.nextUrl.searchParams.get('signalType')?.trim().slice(0, 120) || ''
    const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('page') || '1', 10))
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('pageSize') || '20', 10)),
    )
    if (!['pending', 'reviewed', 'all'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
    }

    const countries = getCrmCountryCodes(security)
    const where: any = {
      ...(status === 'pending' ? { reviewedAt: null } : {}),
      ...(status === 'reviewed' ? { reviewedAt: { not: null } } : {}),
      ...(severity ? { severity } : {}),
      ...(signalType ? { signalType } : {}),
      ...(countries === null
        ? {}
        : {
            providerIdentity: {
              countryCode: { in: countries.length > 0 ? countries : ['__NONE__'] },
            },
          }),
    }

    const skip = (page - 1) * pageSize
    const [signals, total] = await Promise.all([
      prisma.providerIntegritySignal.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      prisma.providerIntegritySignal.count({ where }),
    ])

    const providerIdentityIds = [
      ...new Set(
        signals
          .map(signal => signal.providerIdentityId)
          .filter((value): value is string => Boolean(value)),
      ),
    ]

    const identities = providerIdentityIds.length
      ? await prisma.providerIdentity.findMany({
          where: { id: { in: providerIdentityIds } },
          select: {
            id: true,
            identityType: true,
            currentUserId: true,
            countryCode: true,
            kycStatus: true,
            standingStatus: true,
            verifiedDisplayName: true,
            closedAt: true,
            financialAccounts: {
              select: {
                currency: true,
                commissionDue: true,
                status: true,
                cashJobsAllowed: true,
                onlineJobsAllowed: true,
                manualReviewRequired: true,
              },
            },
          },
        })
      : []

    const identityMap = new Map(identities.map(identity => [identity.id, identity]))
    const userIds = [
      ...new Set(
        identities
          .map(identity => identity.currentUserId)
          .concat(signals.map(signal => signal.userId))
          .filter((value): value is string => Boolean(value)),
      ),
    ]
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            mxId: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            isSuspended: true,
            isBanned: true,
            identityStatus: true,
            countryCode: true,
          },
        })
      : []
    const userMap = new Map(users.map(user => [user.id, user]))

    return NextResponse.json(
      {
        signals: signals.map(signal => {
          const identity = signal.providerIdentityId
            ? identityMap.get(signal.providerIdentityId) || null
            : null
          const userId = identity?.currentUserId || signal.userId || null
          return {
            id: signal.id,
            providerIdentityId: signal.providerIdentityId,
            userId: signal.userId,
            jobId: signal.jobId,
            signalType: signal.signalType,
            severity: signal.severity,
            source: signal.source,
            status: signal.status,
            metadata: safeMetadata(signal.metadata),
            reviewedAt: signal.reviewedAt?.toISOString() || null,
            reviewedBy: signal.reviewedBy,
            resolution: signal.resolution,
            createdAt: signal.createdAt.toISOString(),
            identity: identity
              ? {
                  ...identity,
                  closedAt: identity.closedAt?.toISOString() || null,
                  financialAccounts: identity.financialAccounts.map(account => ({
                    currency: account.currency,
                    commissionDueMinor: account.commissionDue.toString(),
                    status: account.status,
                    cashJobsAllowed: account.cashJobsAllowed,
                    onlineJobsAllowed: account.onlineJobsAllowed,
                    manualReviewRequired: account.manualReviewRequired,
                  })),
                }
              : null,
            user: userId ? userMap.get(userId) || null : null,
          }
        }),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    secureConsole.error('CRM provider integrity GET error:', error)
    return NextResponse.json({ error: 'Failed to load provider integrity signals' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'risk_events:resolve',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const signalId = typeof body.signalId === 'string' ? body.signalId.trim() : ''
    const status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : ''
    const resolution =
      typeof body.resolution === 'string' ? body.resolution.trim().slice(0, 2000) : ''

    if (!signalId || !REVIEW_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid integrity review payload' }, { status: 400 })
    }
    if (resolution.length < 4) {
      return NextResponse.json({ error: 'A clear review resolution is required' }, { status: 400 })
    }

    const signal = await prisma.providerIntegritySignal.findUnique({
      where: { id: signalId },
    })
    if (!signal) {
      return NextResponse.json({ error: 'Integrity signal not found' }, { status: 404 })
    }
    if (signal.reviewedAt) {
      return NextResponse.json(
        { error: 'Integrity signal has already been reviewed', code: 'ALREADY_REVIEWED' },
        { status: 409 },
      )
    }

    if (!signal.providerIdentityId) {
      if (!security.isSuperAdmin) {
        return NextResponse.json({ error: 'Provider identity scope is required' }, { status: 403 })
      }
    } else {
      const identity = await prisma.providerIdentity.findUnique({
        where: { id: signal.providerIdentityId },
        select: { id: true, countryCode: true, standingStatus: true },
      })
      if (!identity || !assertCrmCountryAllowed(security, identity.countryCode)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const reviewedAt = new Date()
    const updated = await prisma.$transaction(async tx => {
      const reviewed = await tx.providerIntegritySignal.update({
        where: { id: signal.id },
        data: {
          status,
          reviewedAt,
          reviewedBy: security.adminId,
          resolution,
        },
      })

      if (
        signal.signalType === 'CUSTOMER_WORKER_IDENTITY_MISMATCH' &&
        signal.jobId &&
        signal.providerIdentityId
      ) {
        await tx.marketplaceRiskEvent.updateMany({
          where: {
            jobId: signal.jobId,
            eventType: 'WORKER_IDENTITY_MISMATCH',
            reviewedAt: null,
          },
          data: {
            reviewedAt,
            reviewedBy: security.adminId,
            resolution: status,
          },
        })

        // A customer cannot undo a mismatch. Only a governed T&S dismissal can
        // clear the start-work block; confirming/escalating the signal leaves it blocked.
        if (status === 'DISMISSED') {
          await tx.jobWorkerIdentityCheck.updateMany({
            where: {
              jobId: signal.jobId,
              providerIdentityId: signal.providerIdentityId,
              status: 'MISMATCH_REPORTED',
            },
            data: {
              status: 'MATCHED',
              confirmedAt: reviewedAt,
            },
          })
        }
      }

      return reviewed
    })

    await createAuditLog({
      action: 'PROVIDER_INTEGRITY_SIGNAL_REVIEWED',
      category: 'security',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'ProviderIntegritySignal',
      entityId: signal.id,
      entityName: signal.signalType,
      description: `Provider integrity signal reviewed as ${status}: ${resolution}`,
      oldValue: {
        status: signal.status,
        reviewedAt: signal.reviewedAt,
        resolution: signal.resolution,
      },
      newValue: {
        status: updated.status,
        reviewedAt: updated.reviewedAt,
        resolution: updated.resolution,
      },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      sessionId: security.sessionId,
      riskLevel: signal.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
    })

    return NextResponse.json({
      success: true,
      signal: {
        id: updated.id,
        status: updated.status,
        reviewedAt: updated.reviewedAt?.toISOString() || null,
        reviewedBy: updated.reviewedBy,
        resolution: updated.resolution,
      },
    })
  } catch (error) {
    secureConsole.error('CRM provider integrity PATCH error:', error)
    return NextResponse.json({ error: 'Failed to review provider integrity signal' }, { status: 500 })
  }
}
