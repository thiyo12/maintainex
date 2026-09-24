import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { fundEscrow } from '@/lib/domain/job-lifecycle'
import { notifyEscrowDeposited } from '@/lib/notifications'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'
import { auditEscrowFund } from '@/lib/financial-audit'

async function resolveProviderNotificationUser(providerId: string, providerType: string): Promise<string> {
  if (providerType === 'COMPANY') {
    const company = await prisma.companyProfile.findUnique({
      where: { id: providerId },
      select: { userId: true },
    })
    if (!company) throw new Error('Company provider not found')
    return company.userId
  }
  return providerId
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const rateLimitResponse = await requireFinancialRateLimit(request, 'escrow-fund')
    if (rateLimitResponse) return rateLimitResponse

    const job = await prisma.marketplaceJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const quote = await prisma.jobQuote.findFirst({
      where: { jobId: job.id, status: 'ACCEPTED' },
      select: { providerId: true, providerType: true },
    })

    await fundEscrow(
      { jobId: job.id, actorId: user.id, actorType: 'CUSTOMER' },
      job.id,
    )

    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: job.id } })
    if (escrow) {
      auditEscrowFund({
        jobId: job.id,
        escrowId: escrow.id,
        actorId: user.id,
        amount: escrow.totalAmount ?? escrow.amount,
        currency: escrow.currency,
      })
    }

    if (quote) {
      const notificationUserId = await resolveProviderNotificationUser(quote.providerId, quote.providerType)
      await notifyEscrowDeposited(job.id, notificationUserId, job.title)
    }
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error: any) {
    console.error('Escrow error:', error)
    const message = error?.message || 'Server error'
    if (message.includes('Only the customer')) return NextResponse.json({ error: message }, { status: 403 })
    if (message.includes('not found')) return NextResponse.json({ error: message }, { status: 404 })
    if (message.includes('already active') || message.includes('state changed')) return NextResponse.json({ error: message }, { status: 409 })
    if (message.includes('INSUFFICIENT_FUNDS') || message.includes('Insufficient') || message.includes('not ready') || message.includes('accepted quote')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (message.includes('Cash escrow')) {
      return NextResponse.json({ error: message }, { status: 503 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    let isParticipant = job.customerId === user.id
    if (!isParticipant) {
      const acceptedQuote = await prisma.jobQuote.findFirst({
        where: { jobId: id, status: 'ACCEPTED' },
        select: { providerId: true, providerType: true },
      })
      if (acceptedQuote?.providerType === 'INDIVIDUAL') {
        isParticipant = acceptedQuote.providerId === user.id
      } else if (acceptedQuote?.providerType === 'COMPANY') {
        isParticipant = !!(await prisma.teamMember.findFirst({
          where: { companyId: acceptedQuote.providerId, userId: user.id, status: 'ACTIVE' },
          select: { id: true },
        }))
      }
    }

    if (!isParticipant) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: id } })
    return NextResponse.json({
      escrow: escrow ? {
        ...escrow,
        amount: escrow.amount.toString(),
        serviceFee: escrow.serviceFee.toString(),
        totalAmount: escrow.totalAmount.toString(),
      } : null,
    })
  } catch (error) {
    console.error('Get escrow error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
