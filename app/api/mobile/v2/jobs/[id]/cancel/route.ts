import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { refundEscrow, resolveProviderActor, transitionMarketplaceJob, type ActorType } from '@/lib/domain/job-lifecycle'
import { verifyJobPin } from '@/lib/domain/job-pin'
import { notifyJobCancelled } from '@/lib/notifications'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'

async function providerNotificationUser(providerId: string, providerType: string): Promise<string | null> {
  if (providerType === 'INDIVIDUAL') return providerId
  const company = await prisma.companyProfile.findUnique({
    where: { id: providerId },
    select: { userId: true },
  })
  return company?.userId || null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json().catch(() => ({}))
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''
    const pin = typeof body.pin === 'string' ? body.pin.trim() : ''

    const job = await prisma.marketplaceJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.status === 'COMPLETED') return NextResponse.json({ error: 'Completed jobs cannot be cancelled' }, { status: 409 })
    if (job.status === 'CANCELLED') return NextResponse.json({ success: true, alreadyCancelled: true })

    const workspace = await prisma.jobWorkspace.findUnique({
      where: { jobId: id },
      select: { progressStatus: true },
    })
    if (workspace && workspace.progressStatus !== 'ACCEPTED') {
      return NextResponse.json({
        error: 'Work has already started. Use the dispute flow instead of cancellation.',
        code: 'WORK_ALREADY_STARTED_USE_DISPUTE',
      }, { status: 409 })
    }

    const acceptedQuote = await prisma.jobQuote.findFirst({
      where: { jobId: id, status: 'ACCEPTED' },
      select: { providerId: true, providerType: true },
    })

    const isCustomer = job.customerId === user.id
    const providerActor = isCustomer ? null : await resolveProviderActor(id, user.id)

    if (!isCustomer && !providerActor) {
      return NextResponse.json({ error: 'Only the customer or accepted provider can cancel this job' }, { status: 403 })
    }

    if (!isCustomer) {
      if (!pin) {
        return NextResponse.json({
          error: 'Customer job PIN is required for provider cancellation before work starts',
          code: 'CANCELLATION_PIN_REQUIRED',
        }, { status: 400 })
      }
      const verified = await verifyJobPin(id, user.id, pin, 'CANCELLATION')
      if (!verified.valid) {
        return NextResponse.json({ error: verified.error || 'Invalid cancellation PIN', locked: verified.locked }, { status: verified.locked ? 423 : 401 })
      }
    }

    const escrow = await prisma.jobEscrow.findFirst({
      where: { jobId: id, status: { in: ['PENDING_PAYMENT', 'PROTECTED', 'ON_HOLD'] } },
      select: { id: true },
    })

    if (escrow) {
      const rateLimitResponse = await requireFinancialRateLimit(request, 'job-cancel-refund')
      if (rateLimitResponse) return rateLimitResponse

      await refundEscrow(
        { jobId: id, actorId: user.id, actorType: isCustomer ? 'CUSTOMER' : providerActor as ActorType, reason },
        id,
      )
    } else {
      if (job.status === 'OPEN' || job.status === 'QUOTE_ACCEPTED') {
        await transitionMarketplaceJob(
          { jobId: id, actorId: user.id, actorType: isCustomer ? 'CUSTOMER' : providerActor as ActorType, reason },
          'CANCELLED',
        )
      } else {
        await prisma.marketplaceJob.updateMany({
          where: { id, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
          data: { status: 'CANCELLED' },
        })
      }
      await prisma.jobQuote.updateMany({
        where: { jobId: id, status: { in: ['PENDING', 'ACCEPTED'] } },
        data: { status: 'WITHDRAWN' },
      })
    }

    const auditDetails = JSON.stringify({
      reason: reason || null,
      cancelledBy: isCustomer ? 'CUSTOMER' : providerActor,
      pinConfirmed: !isCustomer,
    })
    await prisma.securityAudit.create({
      data: {
        action: 'JOB_CANCELLED',
        category: 'JOB',
        userId: user.id,
        userEmail: user.email,
        description: `Job ${id} cancelled before work start`,
        details: auditDetails,
        riskLevel: 'LOW',
        isSuspicious: false,
      },
    }).catch(() => {})

    if (acceptedQuote) {
      const providerUserId = await providerNotificationUser(acceptedQuote.providerId, acceptedQuote.providerType)
      if (isCustomer && providerUserId) {
        void notifyJobCancelled(id, providerUserId, job.title, 'the customer')
      } else if (!isCustomer) {
        void notifyJobCancelled(id, job.customerId, job.title, 'the provider')
      }
    }

    return NextResponse.json({
      success: true,
      status: 'CANCELLED',
      refunded: Boolean(escrow),
      reason: reason || null,
    })
  } catch (error: any) {
    console.error('Cancel job error:', error)
    const message = error?.message || 'Server error'
    if (message.includes('Cannot transition')) return NextResponse.json({ error: message }, { status: 409 })
    if (message.includes('refund')) return NextResponse.json({ error: message }, { status: 409 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
