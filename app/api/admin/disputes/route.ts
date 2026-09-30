import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  getCrmCountryFilter,
  guardCrmRequest,
} from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'
import { completeAndReleaseEscrow, refundEscrow } from '@/lib/finance/escrow/escrow-service'
import { getCurrencyForCountry, minorUnitsToMajorUnits } from '@/lib/shared/money/money'

const VALID_STATUSES = new Set(['OPEN', 'UNDER_REVIEW', 'RESOLVING', 'RESOLVED', 'DISMISSED'])
const MARKETPLACE_RESOLUTION_ACTIONS = new Set(['RELEASE_PROVIDER', 'REFUND_CUSTOMER'])

function toTimestamp(value: Date | string) {
  return new Date(value).getTime()
}

async function finalizeMarketplaceDisputeRecord(params: {
  disputeId: string
  adminId: string
  resolution: string
  resolutionAction: 'RELEASE_PROVIDER' | 'REFUND_CUSTOMER'
}) {
  const updated = await prisma.marketplaceDispute.update({
    where: { id: params.disputeId },
    data: {
      status: 'RESOLVED',
      resolution: params.resolution,
      resolutionAction: params.resolutionAction,
      resolvedBy: params.adminId,
      resolvedAt: new Date(),
    },
  })

  await prisma.adminAlert.updateMany({
    where: {
      targetTable: 'MarketplaceDispute',
      targetId: params.disputeId,
      status: { in: ['open', 'in_progress'] },
    },
    data: {
      status: 'resolved',
      resolvedAt: new Date(),
      resolvedBy: params.adminId,
      notes: params.resolution,
    },
  })

  return updated
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'disputes:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const status = (searchParams.get('status') || '').toUpperCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50))
    const skip = (page - 1) * limit
    const fetchLimit = skip + limit

    if (status && status !== 'ALL' && !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
    }

    const legacyWhere: any = { ...getCrmCountryFilter(security) }
    const marketplaceWhere: any = { ...getCrmCountryFilter(security) }
    if (status && status !== 'ALL') {
      legacyWhere.status = status
      marketplaceWhere.status = status
    }

    const [
      legacyDisputes,
      marketplaceDisputes,
      legacyTotal,
      marketplaceTotal,
    ] = await Promise.all([
      prisma.dispute.findMany({
        where: legacyWhere,
        include: {
          job: {
            select: { id: true, title: true, budget: true, status: true },
          },
          raisedBy: {
            select: { id: true, mxId: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: fetchLimit,
      }),
      prisma.marketplaceDispute.findMany({
        where: marketplaceWhere,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              status: true,
              countryCode: true,
              budgetAmount: true,
              finalAuthorizedAmountCents: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: fetchLimit,
      }),
      prisma.dispute.count({ where: legacyWhere }),
      prisma.marketplaceDispute.count({ where: marketplaceWhere }),
    ])

    const marketplaceUserIds = [...new Set(marketplaceDisputes.map(item => item.raisedById))]
    const marketplaceUsers = marketplaceUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: marketplaceUserIds } },
          select: { id: true, mxId: true, name: true, email: true },
        })
      : []
    const userById = new Map(marketplaceUsers.map(user => [user.id, user]))

    const normalizedLegacy = legacyDisputes.map(dispute => ({
      ...dispute,
      source: 'LEGACY' as const,
      escrowId: null,
      resolutionAction: null,
      job: {
        id: dispute.job.id,
        title: dispute.job.title,
        budget: dispute.job.budget,
        status: dispute.job.status,
      },
    }))

    const normalizedMarketplace = marketplaceDisputes.map(dispute => {
      const currency = getCurrencyForCountry(dispute.job.countryCode)
      const budgetMinor =
        dispute.job.finalAuthorizedAmountCents ??
        dispute.job.budgetAmount ??
        0n
      const raisedBy = userById.get(dispute.raisedById)

      return {
        id: dispute.id,
        source: 'MARKETPLACE' as const,
        jobId: dispute.jobId,
        escrowId: dispute.escrowId,
        raisedById: dispute.raisedById,
        actorType: dispute.actorType,
        reason: dispute.reason,
        description: dispute.description || '',
        resolution: dispute.resolution,
        resolutionAction: dispute.resolutionAction,
        status: dispute.status,
        countryCode: dispute.countryCode,
        createdAt: dispute.createdAt,
        updatedAt: dispute.updatedAt,
        job: {
          id: dispute.job.id,
          title: dispute.job.title,
          budget: minorUnitsToMajorUnits(budgetMinor, currency),
          status: dispute.job.status,
        },
        raisedBy: raisedBy || {
          id: dispute.raisedById,
          mxId: null,
          name: 'Marketplace participant',
          email: '',
        },
      }
    })

    const disputes = [...normalizedLegacy, ...normalizedMarketplace]
      .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
      .slice(skip, skip + limit)

    const total = legacyTotal + marketplaceTotal
    return NextResponse.json(
      {
        disputes,
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
    console.error('CRM disputes GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch disputes' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'disputes:resolve',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const disputeId = typeof body?.disputeId === 'string' ? body.disputeId.trim() : ''
    const status = typeof body?.status === 'string' ? body.status.trim().toUpperCase() : ''
    const resolution = typeof body?.resolution === 'string' ? body.resolution.trim().slice(0, 5000) : ''
    const resolutionAction =
      typeof body?.resolutionAction === 'string'
        ? body.resolutionAction.trim().toUpperCase()
        : ''

    if (!disputeId || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid dispute update payload' }, { status: 400 })
    }

    const marketplaceDispute = await prisma.marketplaceDispute.findUnique({
      where: { id: disputeId },
      include: {
        job: {
          select: { id: true, title: true, status: true, countryCode: true },
        },
      },
    })

    if (marketplaceDispute) {
      if (!assertCrmCountryAllowed(security, marketplaceDispute.countryCode || marketplaceDispute.job.countryCode)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      if (status === 'DISMISSED') {
        return NextResponse.json(
          {
            error: 'Marketplace disputes hold customer funds and cannot be dismissed without a financial resolution.',
            code: 'MARKETPLACE_DISPUTE_REQUIRES_FINANCIAL_RESOLUTION',
          },
          { status: 409 }
        )
      }

      if (status === 'UNDER_REVIEW') {
        if (marketplaceDispute.status === 'UNDER_REVIEW') {
          return NextResponse.json({ dispute: marketplaceDispute })
        }
        if (marketplaceDispute.status !== 'OPEN') {
          return NextResponse.json({ error: 'Dispute is not open for review' }, { status: 409 })
        }

        const claimed = await prisma.marketplaceDispute.updateMany({
          where: { id: disputeId, status: 'OPEN' },
          data: { status: 'UNDER_REVIEW' },
        })
        if (claimed.count !== 1) {
          return NextResponse.json({ error: 'Dispute state changed concurrently' }, { status: 409 })
        }

        await prisma.adminAlert.updateMany({
          where: {
            targetTable: 'MarketplaceDispute',
            targetId: disputeId,
            status: 'open',
          },
          data: {
            status: 'in_progress',
            assignedTo: security.adminId,
          },
        })

        const updated = await prisma.marketplaceDispute.findUniqueOrThrow({ where: { id: disputeId } })
        await createAuditLog({
          action: 'UPDATE',
          category: 'DISPUTE',
          userId: security.adminId,
          userEmail: security.email,
          userRole: security.role,
          entityType: 'MarketplaceDispute',
          entityId: disputeId,
          entityName: marketplaceDispute.reason,
          description: 'Marketplace dispute moved to UNDER_REVIEW',
          oldValue: { status: marketplaceDispute.status },
          newValue: { status: 'UNDER_REVIEW' },
          ipAddress: security.ipAddress,
          userAgent: security.userAgent || undefined,
          riskLevel: 'LOW',
        })
        return NextResponse.json({ dispute: updated })
      }

      if (status !== 'RESOLVED') {
        return NextResponse.json(
          { error: 'Marketplace disputes support UNDER_REVIEW or RESOLVED actions only' },
          { status: 400 }
        )
      }

      if (resolution.length < 3) {
        return NextResponse.json({ error: 'Resolution notes are required' }, { status: 400 })
      }
      if (!MARKETPLACE_RESOLUTION_ACTIONS.has(resolutionAction)) {
        return NextResponse.json(
          { error: 'resolutionAction must be RELEASE_PROVIDER or REFUND_CUSTOMER' },
          { status: 400 }
        )
      }

      const canonicalAction = resolutionAction as 'RELEASE_PROVIDER' | 'REFUND_CUSTOMER'

      if (marketplaceDispute.status === 'RESOLVED') {
        if (marketplaceDispute.resolutionAction !== canonicalAction) {
          return NextResponse.json({ error: 'Dispute was already resolved with a different financial action' }, { status: 409 })
        }
        return NextResponse.json({ dispute: marketplaceDispute })
      }

      if (marketplaceDispute.status === 'RESOLVING') {
        const escrow = await prisma.jobEscrow.findUnique({
          where: { id: marketplaceDispute.escrowId },
          select: { status: true },
        })

        if (
          canonicalAction === 'RELEASE_PROVIDER' &&
          escrow?.status === 'RELEASED' &&
          marketplaceDispute.job.status === 'COMPLETED'
        ) {
          const updated = await finalizeMarketplaceDisputeRecord({
            disputeId,
            adminId: security.adminId,
            resolution,
            resolutionAction: canonicalAction,
          })
          return NextResponse.json({ dispute: updated, recovered: true })
        }

        if (canonicalAction === 'REFUND_CUSTOMER') {
          if (escrow?.status === 'REFUNDED') {
            const updated = await finalizeMarketplaceDisputeRecord({
              disputeId,
              adminId: security.adminId,
              resolution,
              resolutionAction: canonicalAction,
            })
            return NextResponse.json({ dispute: updated, recovered: true })
          }

          const refundIntent = await prisma.paymentIntent.findFirst({
            where: {
              escrowId: marketplaceDispute.escrowId,
              status: { in: ['REFUND_REQUIRED', 'REFUND_PROCESSING'] },
            },
            select: { status: true },
            orderBy: { updatedAt: 'desc' },
          })
          if (refundIntent || escrow?.status === 'ON_HOLD') {
            return NextResponse.json(
              {
                dispute: marketplaceDispute,
                refundStatus: refundIntent?.status || 'REFUND_PROCESSING',
                message: 'Customer refund is still being reconciled.',
              },
              { status: 202 }
            )
          }
        }

        return NextResponse.json({ error: 'Dispute resolution is already in progress' }, { status: 409 })
      }

      if (!['OPEN', 'UNDER_REVIEW'].includes(marketplaceDispute.status)) {
        return NextResponse.json({ error: 'Dispute cannot be resolved from its current state' }, { status: 409 })
      }

      const claimed = await prisma.marketplaceDispute.updateMany({
        where: {
          id: disputeId,
          status: { in: ['OPEN', 'UNDER_REVIEW'] },
        },
        data: {
          status: 'RESOLVING',
          resolution,
          resolutionAction: canonicalAction,
          resolvedBy: security.adminId,
        },
      })
      if (claimed.count !== 1) {
        return NextResponse.json({ error: 'Dispute state changed concurrently' }, { status: 409 })
      }

      let moneyApplied = false
      try {
        if (canonicalAction === 'RELEASE_PROVIDER') {
          await completeAndReleaseEscrow(
            {
              jobId: marketplaceDispute.jobId,
              actorId: security.adminId,
              actorType: 'STAFF',
              reason: resolution,
            },
            marketplaceDispute.jobId,
            { releaseMode: 'ADMIN_RESOLUTION' }
          )
          moneyApplied = true

          const updated = await finalizeMarketplaceDisputeRecord({
            disputeId,
            adminId: security.adminId,
            resolution,
            resolutionAction: canonicalAction,
          })

          await createAuditLog({
            action: 'UPDATE',
            category: 'DISPUTE',
            userId: security.adminId,
            userEmail: security.email,
            userRole: security.role,
            entityType: 'MarketplaceDispute',
            entityId: disputeId,
            entityName: marketplaceDispute.reason,
            description: 'Marketplace dispute resolved by releasing escrow to provider',
            oldValue: { status: marketplaceDispute.status },
            newValue: { status: 'RESOLVED', resolutionAction: canonicalAction, resolution },
            ipAddress: security.ipAddress,
            userAgent: security.userAgent || undefined,
            riskLevel: 'HIGH',
          })

          return NextResponse.json({
            dispute: updated,
            financialAction: canonicalAction,
          })
        }

        const refund = await refundEscrow(
          {
            jobId: marketplaceDispute.jobId,
            actorId: security.adminId,
            actorType: 'STAFF',
            reason: resolution,
          },
          marketplaceDispute.jobId,
        )
        moneyApplied = true

        await createAuditLog({
          action: 'UPDATE',
          category: 'DISPUTE',
          userId: security.adminId,
          userEmail: security.email,
          userRole: security.role,
          entityType: 'MarketplaceDispute',
          entityId: disputeId,
          entityName: marketplaceDispute.reason,
          description: refund.refundPendingExternal
            ? 'Marketplace dispute customer refund queued for external reconciliation'
            : 'Marketplace dispute resolved by refunding customer',
          oldValue: { status: marketplaceDispute.status },
          newValue: {
            status: refund.refundPendingExternal ? 'RESOLVING' : 'RESOLVED',
            resolutionAction: canonicalAction,
            resolution,
            fundingSource: refund.fundingSource,
          },
          ipAddress: security.ipAddress,
          userAgent: security.userAgent || undefined,
          riskLevel: 'HIGH',
        })

        if (refund.refundPendingExternal) {
          await prisma.adminAlert.updateMany({
            where: {
              targetTable: 'MarketplaceDispute',
              targetId: disputeId,
              status: { in: ['open', 'in_progress'] },
            },
            data: {
              status: 'in_progress',
              assignedTo: security.adminId,
              notes: 'Customer refund is awaiting external PayHere reconciliation.',
            },
          })

          const resolving = await prisma.marketplaceDispute.findUniqueOrThrow({ where: { id: disputeId } })
          return NextResponse.json(
            {
              dispute: resolving,
              financialAction: canonicalAction,
              refundStatus: 'REFUND_REQUIRED',
              message: 'Refund queued. Dispute will close after external reconciliation.',
            },
            { status: 202 }
          )
        }

        const updated = await finalizeMarketplaceDisputeRecord({
          disputeId,
          adminId: security.adminId,
          resolution,
          resolutionAction: canonicalAction,
        })
        return NextResponse.json({
          dispute: updated,
          financialAction: canonicalAction,
        })
      } catch (error) {
        if (!moneyApplied) {
          await prisma.marketplaceDispute.updateMany({
            where: { id: disputeId, status: 'RESOLVING' },
            data: { status: 'UNDER_REVIEW' },
          })
        }
        throw error
      }
    }

    // Legacy JobPosting dispute compatibility.
    const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } })
    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    }
    if (!assertCrmCountryAllowed(security, dispute.countryCode || 'LK')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (status === 'RESOLVED' && resolution.length < 3) {
      return NextResponse.json({ error: 'Resolution notes are required' }, { status: 400 })
    }

    const updated = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status,
        resolution: resolution || dispute.resolution,
      },
    })

    await createAuditLog({
      action: 'UPDATE',
      category: 'DISPUTE',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'Dispute',
      entityId: dispute.id,
      entityName: dispute.reason,
      description: `Legacy CRM dispute changed from ${dispute.status} to ${status}`,
      oldValue: { status: dispute.status, resolution: dispute.resolution },
      newValue: { status, resolution: resolution || dispute.resolution },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: status === 'RESOLVED' ? 'MEDIUM' : 'LOW',
    })

    return NextResponse.json({ dispute: updated })
  } catch (error) {
    console.error('CRM disputes PATCH error:', error)
    const message = error instanceof Error ? error.message : 'Failed to update dispute'
    if (
      message.includes('already') ||
      message.includes('concurrently') ||
      message.includes('state changed') ||
      message.includes('not in progress') ||
      message.includes('No releasable escrow') ||
      message.includes('No refundable escrow') ||
      message.includes('Admin resolution requires')
    ) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    if (message === 'CASH_PAYMENT_DISABLED') {
      return NextResponse.json(
        { error: 'Cash settlement is disabled until its accounting flow is implemented.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'Failed to update dispute' }, { status: 500 })
  }
}
