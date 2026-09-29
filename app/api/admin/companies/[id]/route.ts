import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
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
      prisma.providerDocument.findMany({
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
      }),
      prisma.jobQuote.findMany({
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
      }),
      prisma.companyJobAssignment.findMany({
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
      }),
      prisma.jobEscrow.findMany({
        where: { providerId: company.id },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.commissionSettlement.findMany({
        where: { providerId: company.id },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.payout.findMany({
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
      }),
      prisma.providerWallet.findUnique({ where: { userId: company.userId } }),
      prisma.identityDocument.findMany({
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
      }),
      prisma.auditLog.findMany({
        where: { targetId: company.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.activityLog.findMany({
        where: { entityId: company.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ])

    const jobIds = [...new Set([
      ...quotes.map(quote => quote.jobId),
      ...assignments.map(assignment => assignment.jobId),
    ])]

    const [jobs, riskEvents] = await Promise.all([
      jobIds.length
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
      jobIds.length
        ? prisma.marketplaceRiskEvent.findMany({
            where: { jobId: { in: jobIds } },
            orderBy: { createdAt: 'desc' },
            take: 200,
          })
        : [],
    ])

    return NextResponse.json(
      safeJson({
        company,
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
          company: company.auditLogs,
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
