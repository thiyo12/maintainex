import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { checkWorkerEligibility } from '@/lib/phase6/provider-eligibility'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { companyId, jobId, workerUserId } = body

    if (!companyId || !jobId || !workerUserId) {
      return NextResponse.json({ error: 'companyId, jobId, and workerUserId are required' }, { status: 400 })
    }

    const { context, error } = await resolveCompanyContext(user.id, companyId, 'workers:assign')
    if (error) return error

    const job = await prisma.marketplaceJob.findUnique({
      where: { id: jobId },
      select: { id: true, status: true, targetTaskerId: true, categoryId: true, serviceTemplateId: true },
    })
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.status !== 'QUOTE_ACCEPTED') {
      return NextResponse.json({ error: 'Quote must be accepted before assigning a worker' }, { status: 400 })
    }

    if (job.targetTaskerId) {
      return NextResponse.json({ error: 'Job already assigned to a worker' }, { status: 400 })
    }

    const acceptedQuote = await prisma.jobQuote.findFirst({
      where: { jobId, providerId: companyId, providerType: 'COMPANY', status: 'ACCEPTED' },
    })
    if (!acceptedQuote) {
      return NextResponse.json({ error: 'No accepted quote found for this company on this job' }, { status: 400 })
    }

    const eligibility = await checkWorkerEligibility(companyId, workerUserId, jobId)
    if (!eligibility.eligible) {
      return NextResponse.json({ error: 'Worker not eligible', reasons: eligibility.reasons }, { status: 400 })
    }

    const workerProfile = await prisma.user.findUnique({
      where: { id: workerUserId },
      select: { name: true },
    })

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.marketplaceJob.updateMany({
        where: { id: jobId, status: 'QUOTE_ACCEPTED', targetTaskerId: null },
        data: { targetTaskerId: workerUserId },
      })
      if (claimed.count !== 1) throw new Error('Job state changed concurrently')

      await tx.jobWorkspace.upsert({
        where: { jobId },
        create: { jobId, progressStatus: 'ACCEPTED' },
        update: { progressStatus: 'ACCEPTED', updatedAt: new Date() },
      })

      await writeCompanyAuditLog({
        companyId,
        actorId: user.id,
        actorRole: context!.role,
        action: 'WORKER_ASSIGN',
        targetType: 'MarketplaceJob',
        targetId: jobId,
        description: `Assigned ${workerProfile?.name || workerUserId} to job ${jobId}`,
        metadata: { workerUserId, hasAcceptedQuote: true },
      }, tx)
    })

    return NextResponse.json({ success: true, assignedTo: workerUserId })
  } catch (err) {
    console.error('Worker assignment error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
