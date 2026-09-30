import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  crmHasPermission,
  guardCrmRequest,
  redactCrmSensitiveData,
} from '@/lib/crm/security'

function safeJson(value: unknown) {
  return redactCrmSensitiveData(
    JSON.parse(
      JSON.stringify(value, (_key, child) =>
        typeof child === 'bigint' ? child.toString() : child
      )
    )
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id || id.length > 128) {
      return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 })
    }

    const guard = await guardCrmRequest(request, {
      permission: 'companies:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const company = await prisma.companyProfile.findUnique({
      where: { id },
      include: {
        user: {
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
            suspensionReason: true,
            banReason: true,
            identityStatus: true,
            createdAt: true,
          },
        },
        teamMembers: {
          include: {
            user: {
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
          orderBy: { createdAt: 'desc' },
        },
        subscriptions: {
          include: { plan: true },
          orderBy: { startDate: 'desc' },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
        contracts: {
          include: { milestones: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
        specialties: true,
        companyProfessions: true,
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    if (!assertCrmCountryAllowed(security, company.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const canWork = crmHasPermission(security.role, 'jobs:view')
    const canFinance =
      crmHasPermission(security.role, 'wallets:view') ||
      crmHasPermission(security.role, 'commission:view')
    const canTrust =
      crmHasPermission(security.role, 'kyc:view') ||
      crmHasPermission(security.role, 'risk_events:read') ||
      crmHasPermission(security.role, 'credentials:read')
    const canAudit = crmHasPermission(security.role, 'audit:read')

    const [
      documents,
      quotes,
      assignments,
      escrows,
      settlements,
      payouts,
      wallet,
      ownerIdentityDocs,
      adminAudit,
      activityAudit,
    ] = await Promise.all([
      canTrust ? prisma.providerDocument.findMany({
        where: { providerType: 'COMPANY', providerId: company.id },
        select: {
          id: true,
          documentType: true,
          fileName: true,
          fileUrl: true,
          fileSize: true,
          mimeType: true,
          verificationStatus: true,
          verificationNote: true,
          verifiedBy: true,
          verifiedAt: true,
          isPublic: true,
          uploadedBy: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }) : Promise.resolve([]),
      canWork ? prisma.jobQuote.findMany({
        where: { providerType: 'COMPANY', providerId: company.id },
        select: {
          id: true,
          jobId: true,
          price: true,
          currency: true,
          status: true,
          revisionNumber: true,
          message: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }) : Promise.resolve([]),
      canWork ? prisma.companyJobAssignment.findMany({
        where: { companyId: company.id },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              status: true,
              budgetAmount: true,
              budgetType: true,
              countryCode: true,
              createdAt: true,
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
        take: 200,
      }) : Promise.resolve([]),
      canFinance ? prisma.jobEscrow.findMany({
        where: { providerId: company.id },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }) : Promise.resolve([]),
      canFinance ? prisma.commissionSettlement.findMany({
        where: { providerId: company.id },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }) : Promise.resolve([]),
      canFinance ? prisma.payout.findMany({
        where: { userId: company.userId },
        select: {
          id: true,
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
        take: 200,
      }) : Promise.resolve([]),
      canFinance ? prisma.providerWallet.findUnique({ where: { userId: company.userId } }) : Promise.resolve(null),
      canTrust ? prisma.identityDocument.findMany({
        where: { userId: company.userId },
        select: {
          id: true,
          docType: true,
          side: true,
          imageUrl: true,
          fullName: true,
          status: true,
          reviewNote: true,
          reviewedBy: true,
          reviewedAt: true,
          countryCode: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }) : Promise.resolve([]),
      canAudit ? prisma.auditLog.findMany({
        where: { targetId: company.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }) : Promise.resolve([]),
      canAudit ? prisma.activityLog.findMany({
        where: { entityId: company.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }) : Promise.resolve([]),
    ])

    const jobIds = [...new Set([
      ...quotes.map(quote => quote.jobId),
      ...assignments.map(assignment => assignment.jobId),
    ])]

    const trustJobIds = canTrust && !canWork
      ? [...new Set([
          ...(await prisma.jobQuote.findMany({
            where: { providerType: 'COMPANY', providerId: company.id },
            select: { jobId: true },
            take: 500,
          })).map(row => row.jobId),
          ...(await prisma.companyJobAssignment.findMany({
            where: { companyId: company.id },
            select: { jobId: true },
            take: 500,
          })).map(row => row.jobId),
        ])]
      : jobIds

    const [jobs, riskEvents] = await Promise.all([
      canWork && jobIds.length
        ? prisma.marketplaceJob.findMany({
            where: { id: { in: jobIds } },
            select: {
              id: true,
              title: true,
              status: true,
              budgetAmount: true,
              budgetType: true,
              countryCode: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { createdAt: 'desc' },
          })
        : [],
      canTrust && trustJobIds.length
        ? prisma.marketplaceRiskEvent.findMany({
            where: { jobId: { in: trustJobIds } },
            orderBy: { createdAt: 'desc' },
            take: 200,
          })
        : [],
    ])

    const { auditLogs: embeddedCompanyAudit, ...companyView } = company

    return NextResponse.json(
      safeJson({
        permissions: {
          work: canWork,
          finance: canFinance,
          trust: canTrust,
          audit: canAudit,
        },
        company: companyView,
        documents,
        ownerIdentityDocs,
        jobs,
        quotes,
        assignments,
        finance: {
          escrows,
          settlements,
          payouts,
          wallet,
        },
        trust: {
          riskEvents,
        },
        audit: {
          company: canAudit ? embeddedCompanyAudit : [],
          admin: adminAudit,
          activity: activityAudit,
        },
      }),
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM Company 360 GET error:', error)
    return NextResponse.json({ error: 'Failed to load Company 360' }, { status: 500 })
  }
}
