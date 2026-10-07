import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { createInspection } from '@/lib/domain/inspection'
import { notifyInspectionRequested } from '@/lib/notifications'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { hasCompanyPermission, type CompanyRole } from '@/lib/phase6/rbac'
import { getCurrencyForCountry } from '@/lib/shared/money/money'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { id: jobId } = await params
    const body = await request.json()
    const { inspectionFeeCents } = body

    const [acceptedQuote, job] = await Promise.all([
      prisma.jobQuote.findFirst({
        where: { jobId, status: 'ACCEPTED' },
        select: { providerId: true, providerType: true },
      }),
      prisma.marketplaceJob.findUnique({
        where: { id: jobId },
        select: { id: true, customerId: true, title: true, countryCode: true },
      }),
    ])
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    if (!acceptedQuote) {
      return NextResponse.json({ error: 'Job has no accepted provider' }, { status: 409 })
    }

    let providerType: 'INDIVIDUAL' | 'COMPANY'
    let taskerId: string | undefined
    let companyId: string | undefined
    let notificationUserId = user.id

    if (acceptedQuote.providerType === 'INDIVIDUAL') {
      if (acceptedQuote.providerId !== user.id) {
        return NextResponse.json({ error: 'Not authorized for this job' }, { status: 403 })
      }
      providerType = 'INDIVIDUAL'
      taskerId = user.id
    } else if (acceptedQuote.providerType === 'COMPANY') {
      const { context, error } = await resolveCompanyContext(user.id, acceptedQuote.providerId)
      if (error) return error
      if (!context) {
        return NextResponse.json({ error: 'Not authorized for this company' }, { status: 403 })
      }

      const assignment = await prisma.companyJobAssignment.findFirst({
        where: {
          jobId,
          companyId: acceptedQuote.providerId,
          workerUserId: user.id,
          status: { in: ['ACCEPTED', 'IN_PROGRESS'] },
        },
        select: { id: true },
      })
      const role = context.role as CompanyRole
      const canOperate =
        Boolean(assignment) ||
        hasCompanyPermission(role, 'jobs:manage') ||
        hasCompanyPermission(role, 'jobs:assign')
      if (!canOperate) {
        return NextResponse.json({ error: 'Insufficient company job permissions' }, { status: 403 })
      }

      providerType = 'COMPANY'
      companyId = acceptedQuote.providerId
      notificationUserId = assignment
        ? user.id
        : (await prisma.companyProfile.findUnique({
            where: { id: acceptedQuote.providerId },
            select: { userId: true },
          }))?.userId ?? user.id
    } else {
      return NextResponse.json({ error: 'Unsupported provider type' }, { status: 400 })
    }

    let feeCents: bigint | undefined
    if (inspectionFeeCents !== undefined && inspectionFeeCents !== null && inspectionFeeCents !== '') {
      try {
        feeCents = BigInt(inspectionFeeCents)
      } catch {
        return NextResponse.json({ error: 'Invalid inspectionFeeCents' }, { status: 400 })
      }
      if (feeCents < 0n) {
        return NextResponse.json({ error: 'inspectionFeeCents cannot be negative' }, { status: 400 })
      }
    }

    const result = await createInspection(prisma, {
      jobId,
      providerType,
      taskerId,
      companyId,
      inspectionFeeCents: feeCents,
      currency: getCurrencyForCountry(job.countryCode),
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    await notifyInspectionRequested(job.id, job.customerId, notificationUserId, job.title)

    return NextResponse.json({ success: true, inspectionId: result.inspectionId }, { status: 201 })
  } catch (error) {
    secureConsole.error('Create inspection error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
