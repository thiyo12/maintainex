import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { createChangeOrder, transitionChangeOrder } from '@/lib/domain/change-order'
import { notifyChangeOrderSubmitted } from '@/lib/notifications'
import { resolveCompanyContext } from '@/lib/phase6/company-context'

function parseBigInt(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value)
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return BigInt(value.trim())
  return null
}

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
    const body = await request.json().catch(() => ({}))
    const baseQuoteId = typeof body?.baseQuoteId === 'string' ? body.baseQuoteId.trim().slice(0, 128) : ''
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 2000) : ''
    const scopeDelta = typeof body?.scopeDelta === 'string' ? body.scopeDelta.trim().slice(0, 5000) : undefined
    const lineItems = Array.isArray(body?.lineItems) ? body.lineItems.slice(0, 100) : undefined
    const requestedStatus = typeof body?.status === 'string' ? body.status.toUpperCase() : 'DRAFT'
    const amountDeltaCents = parseBigInt(body?.amountDeltaCents)

    if (!baseQuoteId || reason.length < 3 || amountDeltaCents === null) {
      return NextResponse.json({ error: 'Valid baseQuoteId, reason, and amountDeltaCents are required' }, { status: 400 })
    }
    if (!['DRAFT', 'SUBMITTED'].includes(requestedStatus)) {
      return NextResponse.json({ error: 'status must be DRAFT or SUBMITTED' }, { status: 400 })
    }

    const baseQuote = await prisma.jobQuote.findUnique({
      where: { id: baseQuoteId },
      select: {
        id: true,
        jobId: true,
        providerId: true,
        providerType: true,
        status: true,
        currency: true,
      },
    })
    if (!baseQuote || baseQuote.jobId !== jobId || baseQuote.status !== 'ACCEPTED') {
      return NextResponse.json({ error: 'Accepted base quote not found for this job' }, { status: 404 })
    }

    let providerType: 'INDIVIDUAL' | 'COMPANY'
    let taskerId: string | undefined
    let companyIdVal: string | undefined

    if (baseQuote.providerType === 'INDIVIDUAL') {
      if (baseQuote.providerId !== user.id) {
        return NextResponse.json({ error: 'Not authorized for this quote' }, { status: 403 })
      }
      providerType = 'INDIVIDUAL'
      taskerId = user.id
    } else if (baseQuote.providerType === 'COMPANY') {
      const { context, error } = await resolveCompanyContext(
        user.id,
        baseQuote.providerId,
        'quotes:submit',
      )
      if (error) return error
      if (!context) {
        return NextResponse.json({ error: 'Not authorized for this company' }, { status: 403 })
      }
      providerType = 'COMPANY'
      companyIdVal = baseQuote.providerId
    } else {
      return NextResponse.json({ error: 'Unsupported provider type' }, { status: 400 })
    }

    const result = await createChangeOrder(prisma, {
      jobId,
      baseQuoteId,
      providerType,
      taskerId,
      companyId: companyIdVal,
      reason,
      scopeDelta,
      amountDeltaCents,
      currency: baseQuote.currency,
      createdBy: user.id,
      lineItems: lineItems?.map((item: any, idx: number) => ({
        type: item.type,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitAmountCents: parseBigInt(item.unitAmountCents) ?? 0n,
        totalAmountCents: parseBigInt(item.totalAmountCents) ?? 0n,
        currency: baseQuote.currency,
        sortOrder: idx,
      })),
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    let status: 'DRAFT' | 'SUBMITTED' = 'DRAFT'
    let revisionNumber: number | null = null

    if (requestedStatus === 'SUBMITTED' && result.changeOrderId) {
      const transition = await transitionChangeOrder(prisma, {
        changeOrderId: result.changeOrderId,
        userId: user.id,
        toStatus: 'SUBMITTED',
      })
      if (!transition.success) {
        return NextResponse.json({ error: transition.error || 'Failed to submit change order' }, { status: 409 })
      }
      status = 'SUBMITTED'

      const [job, submitted] = await Promise.all([
        prisma.marketplaceJob.findUnique({
          where: { id: jobId },
          select: { title: true, customerId: true },
        }),
        prisma.jobChangeOrder.findUnique({
          where: { id: result.changeOrderId },
          select: { revisionNumber: true },
        }),
      ])

      revisionNumber = submitted?.revisionNumber ?? null
      if (job && revisionNumber !== null) {
        await notifyChangeOrderSubmitted(
          jobId,
          job.customerId,
          user.name ?? 'Provider',
          job.title,
          revisionNumber,
        )
      }
    }

    return NextResponse.json(
      { success: true, changeOrderId: result.changeOrderId, status, revisionNumber },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create change order error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
