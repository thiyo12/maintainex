import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { createChangeOrder } from '@/lib/domain/change-order'
import { notifyChangeOrderSubmitted } from '@/lib/notifications'
import { resolveCompanyContext } from '@/lib/phase6/company-context'

function parseBigInt(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value)
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return BigInt(value.trim())
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
    const body = await request.json()
    const { baseQuoteId, reason, scopeDelta, lineItems } = body
    const amountDeltaCents = parseBigInt(body.amountDeltaCents)

    if (!baseQuoteId || !reason || amountDeltaCents === null) {
      return NextResponse.json({ error: 'Missing required fields: baseQuoteId, reason, amountDeltaCents' }, { status: 400 })
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

    if (body.status === 'SUBMITTED') {
      const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId }, select: { title: true, customerId: true } })
      const providerName = user.name ?? 'Provider'
      const latestCo = await prisma.jobChangeOrder.findFirst({
        where: { jobId },
        orderBy: { revisionNumber: 'desc' },
        select: { revisionNumber: true },
      })
      if (job && latestCo) {
        await notifyChangeOrderSubmitted(jobId, job.customerId, providerName, job.title, latestCo.revisionNumber)
      }
    }

    return NextResponse.json({ success: true, changeOrderId: result.changeOrderId }, { status: 201 })
  } catch (error) {
    console.error('Create change order error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
