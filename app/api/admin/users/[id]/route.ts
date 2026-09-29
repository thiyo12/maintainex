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

function permissionForRole(role: string): string {
  if (role === 'TASKER') return 'taskers:view'
  if (role === 'COMPANY') return 'companies:view'
  return 'users:view'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id || id.length > 128) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const guard = await guardCrmRequest(request, {
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        mxId: true,
        email: true,
        name: true,
        phone: true,
        phoneVerified: true,
        role: true,
        countryCode: true,
        isActive: true,
        emailVerified: true,
        isSuspended: true,
        isBanned: true,
        banReason: true,
        suspendedUntil: true,
        suspensionReason: true,
        nickname: true,
        identityStatus: true,
        createdAt: true,
        updatedAt: true,
        customerProfile: {
          include: {
            tags: true,
            addresses: {
              where: { isActive: true },
              orderBy: { isDefault: 'desc' },
            },
            notes: {
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
            activities: {
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
            communications: {
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
          },
        },
        taskerProfile: true,
        companyProfile: {
          include: {
            teamMembers: {
              orderBy: { createdAt: 'desc' },
              take: 100,
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
            },
            subscriptions: {
              include: { plan: true },
              orderBy: { startDate: 'desc' },
              take: 20,
            },
            auditLogs: {
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
          },
        },
        identityDocs: {
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
            updatedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        fraudEvents: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        adminFlags: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        loginActivities: {
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            location: true,
            isNewIP: true,
            isNewDevice: true,
            isSuspicious: true,
            reason: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!crmHasPermission(security.role, permissionForRole(user.role))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!assertCrmCountryAllowed(security, user.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const companyId = user.companyProfile?.id
    const taskerId = user.taskerProfile?.id

    const [
      marketplaceJobs,
      classicJobs,
      providerQuotes,
      classicAssignments,
      companyAssignments,
      payouts,
      payoutRequests,
      providerWallet,
      customerWallet,
      jobReviews,
      providerReviews,
      adminAudit,
      activityAudit,
      securityAudit,
    ] = await Promise.all([
      prisma.marketplaceJob.findMany({
        where: { customerId: user.id },
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
        take: 100,
      }),
      prisma.jobPosting.findMany({
        where: { customerId: user.id },
        select: {
          id: true,
          title: true,
          status: true,
          budget: true,
          category: true,
          location: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.jobQuote.findMany({
        where: {
          OR: [
            { providerType: 'INDIVIDUAL', providerId: user.id },
            ...(companyId ? [{ providerType: 'COMPANY', providerId: companyId }] : []),
          ],
        },
        select: {
          id: true,
          jobId: true,
          providerType: true,
          price: true,
          currency: true,
          status: true,
          revisionNumber: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      taskerId
        ? prisma.assignment.findMany({
            where: { taskerId },
            include: {
              job: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  budget: true,
                  createdAt: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
          })
        : Promise.resolve([]),
      prisma.companyJobAssignment.findMany({
        where: {
          OR: [
            { workerUserId: user.id },
            ...(companyId ? [{ companyId }] : []),
          ],
        },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              status: true,
              budgetAmount: true,
              countryCode: true,
              createdAt: true,
            },
          },
          company: {
            select: {
              id: true,
              mxId: true,
              companyName: true,
            },
          },
        },
        orderBy: { assignedAt: 'desc' },
        take: 100,
      }),
      prisma.payout.findMany({
        where: { userId: user.id },
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
        take: 100,
      }),
      prisma.payoutRequest.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          amount: true,
          currency: true,
          method: true,
          status: true,
          notes: true,
          processedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.providerWallet.findUnique({ where: { userId: user.id } }),
      prisma.customerWallet.findUnique({ where: { userId: user.id } }),
      prisma.jobReview.findMany({
        where: { OR: [{ customerId: user.id }, { providerId: user.id }] },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.providerReview.findMany({
        where: { OR: [{ customerId: user.id }, { providerId: user.id }] },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.auditLog.findMany({
        where: { targetId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.activityLog.findMany({
        where: { entityId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.securityAudit.findMany({
        where: { entityId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ])

    return NextResponse.json(
      safeJson({
        user,
        jobs: {
          marketplace: marketplaceJobs,
          classic: classicJobs,
          providerQuotes,
          classicAssignments,
          companyAssignments,
        },
        finance: {
          payouts,
          payoutRequests,
          providerWallet,
          customerWallet,
        },
        reviews: {
          jobReviews,
          providerReviews,
        },
        audit: {
          admin: adminAudit,
          activity: activityAudit,
          security: securityAudit,
        },
      }),
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM User 360 GET error:', error)
    return NextResponse.json({ error: 'Failed to load User 360' }, { status: 500 })
  }
}
