import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { createInspection } from '@/lib/domain/inspection'
import { notifyInspectionRequested } from '@/lib/notifications'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: jobId } = await params
    const body = await request.json()
    const { inspectionFeeCents, currency } = body

    // Verify the caller has an accepted quote on this job
    const acceptedQuote = await prisma.jobQuote.findFirst({
      where: {
        jobId,
        providerId: user.id,
        status: 'ACCEPTED',
      },
    })
    if (!acceptedQuote) {
      return NextResponse.json({ error: 'Not authorized for this job' }, { status: 403 })
    }

    // Resolve provider identity
    let providerType: 'INDIVIDUAL' | 'COMPANY' = 'INDIVIDUAL'
    let taskerId: string | undefined
    let companyId: string | undefined

    if (body.companyId) {
      providerType = 'COMPANY'
      companyId = body.companyId
    } else {
      taskerId = user.id
    }

    const result = await createInspection(prisma, {
      jobId,
      providerType,
      taskerId,
      companyId,
      inspectionFeeCents: inspectionFeeCents ? BigInt(inspectionFeeCents) : undefined,
      currency,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const job = await prisma.marketplaceJob.findUnique({
      where: { id: jobId },
      select: { id: true, customerId: true, title: true },
    })
    if (job) {
      await notifyInspectionRequested(job.id, job.customerId, user.id, job.title)
    }

    return NextResponse.json({ success: true, inspectionId: result.inspectionId }, { status: 201 })
  } catch (error) {
    console.error('Create inspection error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
