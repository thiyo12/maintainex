import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  crmHasPermission,
  guardCrmRequest,
  redactCrmSensitiveData,
} from '@/lib/crm/security'
import { getCurrencyForCountry, minorUnitsToMajorUnits } from '@/lib/shared/money/money'

function money(value: bigint | number | null | undefined, currency: string): number | null {
  if (value === null || value === undefined) return null
  return minorUnitsToMajorUnits(BigInt(value), currency)
}

function safeJson(value: unknown) {
  return redactCrmSensitiveData(
    JSON.parse(
      JSON.stringify(value, (_key, child) =>
        typeof child === 'bigint' ? child.toString() : child
      )
    )
  )
}

async function getV2Job(id: string, request: NextRequest) {
  const guard = await guardCrmRequest(request, {
    permission: 'jobs:view',
    level: 'read',
    requireCountryScope: true,
  })
  if (!guard.ok) return { response: guard.response }
  const security = guard.context

  const job = await prisma.marketplaceJob.findUnique({ where: { id } })
  if (!job) return { notFound: true }

  if (!assertCrmCountryAllowed(security, job.countryCode)) {
    return {
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  const currency = getCurrencyForCountry(job.countryCode)
  const canFinance =
    crmHasPermission(security.role, 'wallets:view') ||
    crmHasPermission(security.role, 'commission:view')
  const canTrust =
    crmHasPermission(security.role, 'disputes:view') ||
    crmHasPermission(security.role, 'risk_events:read') ||
    crmHasPermission(security.role, 'trust:view')
  const canAudit = crmHasPermission(security.role, 'audit:read')

  const [
    customer,
    category,
    area,
    quotes,
    escrow,
    paymentIntents,
    settlements,
    workspace,
    lifecycle,
    inspections,
    changeOrders,
    evidence,
    riskEvents,
    assignments,
    customerReviews,
    providerReviews,
    verificationPin,
    payouts,
    auditLogs,
    activityLogs,
    conversation,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: job.customerId },
      select: {
        id: true,
        mxId: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        countryCode: true,
        isActive: true,
        isSuspended: true,
        isBanned: true,
        createdAt: true,
        customerProfile: {
          select: {
            customerType: true,
            status: true,
            totalBookings: true,
            lastBooking: true,
          },
        },
      },
    }),
    prisma.jobCategory.findUnique({
      where: { id: job.categoryId },
      select: { id: true, name: true },
    }),
    job.areaId
      ? prisma.area.findUnique({
          where: { id: job.areaId },
          select: {
            id: true,
            name: true,
            city: {
              select: {
                name: true,
                state: {
                  select: {
                    name: true,
                    country: { select: { name: true, code: true } },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve(null),
    prisma.jobQuote.findMany({
      where: { jobId: id },
      include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    }),
    canFinance
      ? prisma.jobEscrow.findFirst({
          where: { jobId: id },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve(null),
    canFinance
      ? prisma.paymentIntent.findMany({
          where: { jobId: id },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
    canFinance
      ? prisma.commissionSettlement.findMany({
          where: { jobId: id },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
    prisma.jobWorkspace.findUnique({ where: { jobId: id } }),
    prisma.jobLifecycleEvent.findMany({
      where: { jobId: id },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.jobInspection.findMany({
      where: { jobId: id },
      include: { evidence: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.jobChangeOrder.findMany({
      where: { jobId: id },
      include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.jobEvidence.findMany({
      where: { jobId: id },
      orderBy: { createdAt: 'desc' },
    }),
    canTrust
      ? prisma.marketplaceRiskEvent.findMany({
          where: { jobId: id },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
    prisma.companyJobAssignment.findMany({
      where: { jobId: id },
      include: {
        company: {
          select: {
            id: true,
            mxId: true,
            companyName: true,
            rating: true,
            verificationStatus: true,
            countryCode: true,
          },
        },
        worker: {
          select: {
            id: true,
            mxId: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
            isSuspended: true,
            isBanned: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    }),
    prisma.jobReview.findMany({ where: { jobId: id }, orderBy: { createdAt: 'desc' } }),
    prisma.providerReview.findMany({ where: { jobId: id }, orderBy: { createdAt: 'desc' } }),
    prisma.jobVerificationPin.findFirst({
      where: { jobId: id },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        status: true,
        version: true,
        failedAttempts: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
        rotatedAt: true,
        revokedAt: true,
        lastSuccessfulUseAt: true,
        arrivalVerifiedAt: true,
        workStartVerifiedAt: true,
        completionVerifiedAt: true,
      },
    }),
    canFinance ? prisma.payout.findMany({
      where: { source: 'JOB', sourceId: id },
      select: {
        id: true,
        userId: true,
        amount: true,
        description: true,
        status: true,
        source: true,
        sourceId: true,
        method: true,
        rejectedReason: true,
        processedBy: true,
        currency: true,
        countryCode: true,
        createdAt: true,
        clearedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }) : Promise.resolve([]),
    canAudit ? prisma.auditLog.findMany({
      where: { targetId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }) : Promise.resolve([]),
    canAudit ? prisma.activityLog.findMany({
      where: { entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }) : Promise.resolve([]),
    prisma.conversation.findFirst({
      where: { jobId: id },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, mxId: true, name: true, role: true },
            },
          },
        },
        messages: {
          include: {
            sender: {
              select: { id: true, mxId: true, name: true, role: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    }),
  ])

  const providerIds = [...new Set(quotes.map(quote => quote.providerId))]
  const individualIds = quotes
    .filter(quote => quote.providerType === 'INDIVIDUAL')
    .map(quote => quote.providerId)
  const companyIds = quotes
    .filter(quote => quote.providerType === 'COMPANY')
    .map(quote => quote.providerId)

  const [providerUsers, taskerProfiles, companies] = await Promise.all([
    individualIds.length
      ? prisma.user.findMany({
          where: { id: { in: individualIds } },
          select: {
            id: true,
            mxId: true,
            name: true,
            email: true,
            phone: true,
            countryCode: true,
            isActive: true,
            isSuspended: true,
            isBanned: true,
          },
        })
      : [],
    individualIds.length
      ? prisma.taskerProfile.findMany({
          where: { userId: { in: individualIds } },
          select: {
            userId: true,
            mxId: true,
            rating: true,
            completedJobs: true,
            verificationStatus: true,
            isVerified: true,
            isOnline: true,
            compositeScore: true,
            completionRate: true,
            avgResponseMin: true,
          },
        })
      : [],
    companyIds.length
      ? prisma.companyProfile.findMany({
          where: { id: { in: companyIds } },
          select: {
            id: true,
            userId: true,
            mxId: true,
            companyName: true,
            rating: true,
            completedProjects: true,
            verificationStatus: true,
            isVerified: true,
            subscriptionStatus: true,
            countryCode: true,
          },
        })
      : [],
  ])

  const userMap = new Map(providerUsers.map(user => [user.id, user]))
  const taskerMap = new Map(taskerProfiles.map(profile => [profile.userId, profile]))
  const companyMap = new Map(companies.map(company => [company.id, company]))

  const enrichedQuotes = quotes.map(quote => {
    const provider =
      quote.providerType === 'COMPANY'
        ? companyMap.get(quote.providerId) || null
        : {
            ...(userMap.get(quote.providerId) || {}),
            taskerProfile: taskerMap.get(quote.providerId) || null,
          }

    return {
      ...quote,
      price: money(quote.price, quote.currency || currency),
      subtotal: money(quote.subtotalCents, quote.currency || currency),
      tax: money(quote.taxCents, quote.currency || currency),
      total: money(quote.totalCents, quote.currency || currency),
      lineItems: quote.lineItems.map(line => ({
        ...line,
        unitAmount: money(line.unitAmountCents, line.currency),
        totalAmount: money(line.totalAmountCents, line.currency),
      })),
      provider,
    }
  })

  const acceptedQuote = enrichedQuotes.find(quote => quote.status === 'ACCEPTED') || null
  const acceptedProvider = acceptedQuote?.provider || null

  const ledgerReferenceIds = canFinance
    ? [id, escrow?.id, ...settlements.map(item => item.id)].filter(
        (value): value is string => Boolean(value)
      )
    : []
  const ledger = canFinance && ledgerReferenceIds.length
    ? await prisma.financialLedger.findMany({
        where: { referenceId: { in: ledgerReferenceIds } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
    : []

  const result = {
    source: 'V2' as const,
    permissions: {
      finance: canFinance,
      trust: canTrust,
      audit: canAudit,
    },
    job: {
      ...job,
      budgetAmount: money(job.budgetAmount, currency),
      finalAuthorizedAmount: money(job.finalAuthorizedAmountCents, currency),
      currency,
      category,
      area,
      customer,
      acceptedProvider,
    },
    quotes: enrichedQuotes,
    workspace,
    lifecycle,
    finance: {
      escrow: escrow
        ? {
            ...escrow,
            amount: money(escrow.amount, escrow.currency),
            serviceFee: money(escrow.serviceFee, escrow.currency),
            totalAmount: money(escrow.totalAmount, escrow.currency),
          }
        : null,
      paymentIntents: paymentIntents.map(intent => ({
        ...intent,
        amount: money(intent.amount, intent.currency),
        gatewayResponse: undefined,
      })),
      settlements: settlements.map(settlement => ({
        ...settlement,
        jobAmount: money(settlement.jobAmount, settlement.currency),
        commissionAmount: money(settlement.commissionAmount, settlement.currency),
      })),
      payouts: payouts.map(payout => ({
        ...payout,
        amount: money(payout.amount, payout.currency),
      })),
      ledger: ledger.map(entry => ({
        ...entry,
        amount: money(entry.amount, entry.currency),
      })),
    },
    operations: {
      inspections: inspections.map(inspection => ({
        ...inspection,
        inspectionFee: money(inspection.inspectionFeeCents, inspection.currency),
      })),
      changeOrders: changeOrders.map(order => ({
        ...order,
        amountDelta: money(order.amountDeltaCents, order.currency),
        lineItems: order.lineItems.map(line => ({
          ...line,
          unitAmount: money(line.unitAmountCents, line.currency),
          totalAmount: money(line.totalAmountCents, line.currency),
        })),
      })),
      evidence,
      assignments,
      verificationPin,
      conversation: conversation
        ? {
            ...conversation,
            messages: [...conversation.messages].reverse(),
          }
        : null,
    },
    trust: {
      riskEvents,
    },
    reviews: {
      customer: customerReviews,
      provider: providerReviews,
    },
    audit: {
      canonical: auditLogs,
      activity: activityLogs,
    },
  }

  return { data: safeJson(result) }
}

async function getV1Job(id: string, request: NextRequest) {
  const guard = await guardCrmRequest(request, {
    permission: 'jobs:view',
    level: 'read',
    requireCountryScope: true,
  })
  if (!guard.ok) return { response: guard.response }
  const security = guard.context
  const canFinance =
    crmHasPermission(security.role, 'wallets:view') ||
    crmHasPermission(security.role, 'commission:view')
  const canTrust =
    crmHasPermission(security.role, 'disputes:view') ||
    crmHasPermission(security.role, 'risk_events:read') ||
    crmHasPermission(security.role, 'trust:view')
  const canAudit = crmHasPermission(security.role, 'audit:read')

  const job = await prisma.jobPosting.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          mxId: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          countryCode: true,
          isActive: true,
          isSuspended: true,
          isBanned: true,
        },
      },
      bids: {
        include: {
          tasker: {
            include: {
              user: {
                select: {
                  id: true,
                  mxId: true,
                  name: true,
                  email: true,
                  phone: true,
                  countryCode: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      assignments: {
        include: {
          tasker: {
            include: {
              user: {
                select: {
                  id: true,
                  mxId: true,
                  name: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      disputes: canTrust
        ? {
            include: {
              raisedBy: {
                select: { id: true, mxId: true, name: true, email: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          }
        : false,
    },
  })

  if (!job) return { notFound: true }

  if (!assertCrmCountryAllowed(security, job.customer.countryCode)) {
    return {
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  const [auditLogs, activityLogs, ledger] = await Promise.all([
    canAudit ? prisma.auditLog.findMany({
      where: { targetId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }) : Promise.resolve([]),
    canAudit ? prisma.activityLog.findMany({
      where: { entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }) : Promise.resolve([]),
    canFinance ? prisma.financialLedger.findMany({
      where: { referenceId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }) : Promise.resolve([]),
  ])

  return {
    data: safeJson({
      source: 'V1',
      permissions: {
        finance: canFinance,
        trust: canTrust,
        audit: canAudit,
      },
      job,
      audit: { canonical: auditLogs, activity: activityLogs },
      finance: {
        ledger: ledger.map(entry => ({
          ...entry,
          amount: money(entry.amount, entry.currency),
        })),
      },
    }),
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id || id.length > 128) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 })
    }

    const v2 = await getV2Job(id, request)
    if ('response' in v2 && v2.response) return v2.response
    if ('data' in v2 && v2.data) {
      return NextResponse.json(v2.data, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const v1 = await getV1Job(id, request)
    if ('response' in v1 && v1.response) return v1.response
    if ('data' in v1 && v1.data) {
      return NextResponse.json(v1.data, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  } catch (error) {
    console.error('CRM Job 360 GET error:', error)
    return NextResponse.json({ error: 'Failed to load Job 360' }, { status: 500 })
  }
}
