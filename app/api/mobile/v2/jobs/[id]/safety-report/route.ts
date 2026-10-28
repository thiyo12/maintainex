import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { createWorkItem } from '@/lib/work-queue'
import { secureConsole } from '@/lib/shared/observability/secure-console'

/**
 * Staff safety intake: a report is NOT a financial dispute.
 * Do not automatically change a job, wallet, escrow, payout or payment.
 * The queue does not provide emergency dispatch or guaranteed 24/7 response.
 */
const SAFETY_REASONS = new Set([
  'SAFETY_IMMEDIATE_DANGER',
  'SAFETY_THREAT_OR_HARASSMENT',
  'SAFETY_INJURY',
  'SAFETY_UNSAFE_WORK',
  'SAFETY_IDENTITY_MISMATCH',
])
const BOOKED_STATES = new Set([
  'QUOTE_ACCEPTED', 'ESCROW_DEPOSITED', 'IN_PROGRESS',
  'COMPLETION_PENDING', 'COMPLETED', 'DISPUTED', 'CANCELLED',
])

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
    const body = await request.json()
    const reason = body?.reason
    const description = typeof body?.description === 'string' ? body.description.trim() : ''
    if (!SAFETY_REASONS.has(reason) || description.length < 10 || description.length > 2000) {
      return NextResponse.json({
        error: 'Choose a safety category and describe the incident in 10–2000 characters',
      }, { status: 400 })
    }

    const job = await prisma.marketplaceJob.findUnique({
      where: { id },
      select: { id: true, customerId: true, status: true },
    })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (!BOOKED_STATES.has(job.status)) {
      return NextResponse.json({ error: 'Safety reports here require a booked job' }, { status: 409 })
    }
    const acceptedQuote = await prisma.jobQuote.findFirst({
      where: { jobId: id, status: 'ACCEPTED' },
      select: { providerType: true, providerId: true },
    })
    if (!acceptedQuote) {
      return NextResponse.json({ error: 'No accepted provider for this booking' }, { status: 409 })
    }

    let actorType: 'CUSTOMER' | 'PROVIDER' | 'COMPANY_WORKER' | null = null
    if (job.customerId === user.id) {
      actorType = 'CUSTOMER'
    } else if (acceptedQuote.providerType === 'INDIVIDUAL' &&
               acceptedQuote.providerId === user.id) {
      actorType = 'PROVIDER'
    } else if (acceptedQuote.providerType === 'COMPANY') {
      const [member, assignment] = await Promise.all([
        prisma.teamMember.findFirst({
          where: { companyId: acceptedQuote.providerId, userId: user.id, status: 'ACTIVE' },
          select: { id: true },
        }),
        prisma.companyJobAssignment.findFirst({
          where: {
            companyId: acceptedQuote.providerId,
            jobId: id,
            workerUserId: user.id,
            status: { in: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] },
          },
          select: { id: true },
        }),
      ])
      if (member && assignment) actorType = 'COMPANY_WORKER'
    }
    if (!actorType) {
      return NextResponse.json({ error: 'Not an authorized job participant' }, { status: 403 })
    }

    // The existing manager-owned CRM alert queue is the durable review record.
    // This does not call raiseJobDispute or hold an escrow.
    const alert = await createWorkItem({
      category: 'tasker_escalation',
      severity: 'critical',
      priority: 'critical',
      title: 'Safety incident: ' + reason,
      description: JSON.stringify({
        jobId: job.id, reporterId: user.id, actorType, reason, details: description,
      }),
      targetTable: 'MarketplaceJob',
      targetId: job.id,
    })
    return NextResponse.json({
      success: true,
      reportId: alert.id,
      status: 'RECEIVED',
      message: 'Report recorded for staff review. This is not emergency dispatch.',
    }, { status: 201 })
  } catch (error) {
    secureConsole.error('Safety intake error:', error)
    return NextResponse.json({ error: 'Could not record safety report' }, { status: 500 })
  }
}
