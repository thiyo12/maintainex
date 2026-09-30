import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import {
  transitionChangeOrder,
  approveChangeOrder,
  rejectChangeOrder,
  cancelChangeOrder,
} from '@/lib/domain/change-order'
import {
  notifyChangeOrderApproved,
  notifyChangeOrderRejected,
  notifyChangeOrderSubmitted,
} from '@/lib/notifications'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; changeOrderId: string }> }
) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { id: jobId, changeOrderId } = await params
    const body = await request.json()
    const { action, idempotencyKey } = body

    if (!['submit', 'approve', 'reject', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const co = await prisma.jobChangeOrder.findUnique({
      where: { id: changeOrderId },
      select: {
        id: true,
        revisionNumber: true,
        jobId: true,
        job: {
          select: {
            customerId: true,
            title: true,
          },
        },
      },
    })

    if (!co) return NextResponse.json({ error: 'Change order not found' }, { status: 404 })

    // Get provider from the accepted quote
    const acceptedQuote = await prisma.jobQuote.findFirst({
      where: { jobId: co.jobId, status: 'ACCEPTED' },
      select: { providerId: true },
    })
    const providerId = acceptedQuote?.providerId ?? ''

    if (action === 'approve') {
      const result = await approveChangeOrder(prisma, changeOrderId, user.id, idempotencyKey)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      await notifyChangeOrderApproved(jobId, providerId, co.job.title, co.revisionNumber)
      return NextResponse.json({ success: true })
    }

    if (action === 'reject') {
      const result = await rejectChangeOrder(prisma, changeOrderId, user.id)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      await notifyChangeOrderRejected(jobId, providerId, co.job.title, co.revisionNumber)
      return NextResponse.json({ success: true })
    }

    if (action === 'cancel') {
      const result = await cancelChangeOrder(prisma, changeOrderId, user.id)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({ success: true })
    }

    // action === 'submit'
    const toStatusMap: Record<string, string> = {
      submit: 'SUBMITTED',
    }

    const result = await transitionChangeOrder(prisma, {
      changeOrderId,
      userId: user.id,
      toStatus: toStatusMap[action] as any,
      rejectionReason: body.rejectionReason,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const providerName = user.name ?? 'Provider'
    await notifyChangeOrderSubmitted(jobId, co.job.customerId, providerName, co.job.title, co.revisionNumber)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Change order transition error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; changeOrderId: string }> }
) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: jobId, changeOrderId } = await params

    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId }, select: { customerId: true } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    const acceptedQuote = await prisma.jobQuote.findFirst({ where: { jobId, status: 'ACCEPTED' }, select: { providerId: true } })
    const isProvider = acceptedQuote?.providerId === user.id
    if (job.customerId !== user.id && !isProvider) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const changeOrder = await prisma.jobChangeOrder.findUnique({
      where: { id: changeOrderId },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
      },
    })

    if (!changeOrder) return NextResponse.json({ error: 'Change order not found' }, { status: 404 })

    return NextResponse.json({ changeOrder })
  } catch (error) {
    console.error('Get change order error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
