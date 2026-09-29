import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { createChangeOrder } from '@/lib/domain/change-order'
import { notifyChangeOrderSubmitted } from '@/lib/notifications'

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

    const { id: jobId } = await params
    const body = await request.json()
    const { baseQuoteId, reason, scopeDelta, lineItems } = body
    const amountDeltaCents = parseBigInt(body.amountDeltaCents)

    if (!baseQuoteId || !reason || amountDeltaCents === null) {
      return NextResponse.json({ error: 'Missing required fields: baseQuoteId, reason, amountDeltaCents' }, { status: 400 })
    }

    let providerType: 'INDIVIDUAL' | 'COMPANY' = 'INDIVIDUAL'
    let taskerId: string | undefined
    let companyIdVal: string | undefined

    // Derive company membership from auth, never from request body
    const teamMember = await prisma.teamMember.findFirst({
      where: { userId: user.id },
      select: { companyId: true },
    })

    if (teamMember) {
      providerType = 'COMPANY'
      companyIdVal = teamMember.companyId
    } else {
      taskerId = user.id
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
      createdBy: user.id,
      lineItems: lineItems?.map((item: any, idx: number) => ({
        type: item.type,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitAmountCents: parseBigInt(item.unitAmountCents) ?? 0n,
        totalAmountCents: parseBigInt(item.totalAmountCents) ?? 0n,
        currency: item.currency,
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
