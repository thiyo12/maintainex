import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, createAuditLog, getIp } from '@/lib/admin-rbac'
import { createWorkItem } from '@/lib/work-queue'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jobId = params.id

    // Try V2 first, then V1
    const v2Job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    if (v2Job) {
      const customer = await prisma.user.findUnique({
        where: { id: v2Job.customerId },
        select: { id: true, name: true, email: true, mxId: true },
      })
      const escrow = await prisma.jobEscrow.findFirst({ where: { jobId } })
      return NextResponse.json({
        data: {
          id: v2Job.id,
          title: v2Job.title,
          description: v2Job.description,
          status: v2Job.status,
          budgetCents: Number(v2Job.budgetAmount),
          currency: 'LKR',
          categoryId: v2Job.categoryId,
          source: 'V2',
          client: customer || { id: v2Job.customerId, name: 'Unknown', email: '' },
          worker: null,
          escrow: escrow ? {
            id: escrow.id,
            status: escrow.status,
            amountCents: Number(escrow.totalAmount),
          } : null,
          createdAt: v2Job.createdAt.toISOString(),
        },
      })
    }

    const v1Job = await prisma.jobPosting.findUnique({
      where: { id: jobId },
      include: {
        customer: { select: { id: true, name: true, email: true, mxId: true } },
      },
    })
    if (v1Job) {
      return NextResponse.json({
        data: {
          id: v1Job.id,
          title: v1Job.title,
          description: v1Job.description,
          status: v1Job.status,
          budgetCents: Math.round(v1Job.budget * 100),
          currency: 'LKR',
          categoryId: v1Job.category,
          source: 'V1',
          client: v1Job.customer,
          worker: null,
          escrow: null,
          createdAt: v1Job.createdAt.toISOString(),
        },
      })
    }

    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  } catch (error) {
    console.error('Admin marketplace job GET error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getSessionFromCookie(request)
    if (!session || !['SUPER_ADMIN', 'MANAGER'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jobId = params.id
    const body = await request.json()
    const { action, reason } = body

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }

    const ip = getIp(request)
    const userAgent = request.headers.get('user-agent') || null

    if (action === 'cancel') {
      if (!reason) {
        return NextResponse.json({ error: 'reason is required for cancellation' }, { status: 400 })
      }

      // Try V2 first
      const v2Job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
      if (v2Job) {
        if (v2Job.status === 'CANCELLED') {
          return NextResponse.json({ error: 'Job is already cancelled' }, { status: 400 })
        }
        if (v2Job.status === 'COMPLETED') {
          return NextResponse.json({ error: 'Cannot cancel a completed job' }, { status: 400 })
        }

        const oldValue = { status: v2Job.status }

        await prisma.$transaction([
          prisma.marketplaceJob.update({
            where: { id: jobId },
            data: { status: 'CANCELLED', isActive: false },
          }),
          prisma.jobEscrow.updateMany({
            where: { jobId, status: { in: ['PENDING', 'PROTECTED'] } },
            data: { status: 'REFUNDED', refundedAt: new Date() },
          }),
        ])

        const newValue = { status: 'CANCELLED' }

        await createAuditLog({
          session,
          action: 'JOB_CANCEL',
          targetTable: 'MarketplaceJob',
          targetId: jobId,
          targetLabel: v2Job.title,
          oldValue,
          newValue,
          ipAddress: ip,
          userAgent,
        })

        return NextResponse.json({ success: true, status: 'CANCELLED' })
      }

      // Try V1
      const v1Job = await prisma.jobPosting.findUnique({ where: { id: jobId } })
      if (v1Job) {
        if (v1Job.status === 'CANCELLED') {
          return NextResponse.json({ error: 'Job is already cancelled' }, { status: 400 })
        }
        if (v1Job.status === 'COMPLETED') {
          return NextResponse.json({ error: 'Cannot cancel a completed job' }, { status: 400 })
        }

        const oldValue = { status: v1Job.status }

        await prisma.jobPosting.update({
          where: { id: jobId },
          data: { status: 'CANCELLED' },
        })

        const newValue = { status: 'CANCELLED' }

        await createAuditLog({
          session,
          action: 'JOB_CANCEL',
          targetTable: 'JobPosting',
          targetId: jobId,
          targetLabel: v1Job.title,
          oldValue,
          newValue,
          ipAddress: ip,
          userAgent,
        })

        return NextResponse.json({ success: true, status: 'CANCELLED' })
      }

      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (action === 'flag') {
      if (!reason) {
        return NextResponse.json({ error: 'reason is required for flagging' }, { status: 400 })
      }

      // Find job to get metadata
      const v2Job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
      const v1Job = v2Job ? null : await prisma.jobPosting.findUnique({ where: { id: jobId } })
      const jobTitle = v2Job?.title || v1Job?.title
      if (!jobTitle) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }

      await createAuditLog({
        session,
        action: 'JOB_FLAG',
        targetTable: v2Job ? 'MarketplaceJob' : 'JobPosting',
        targetId: jobId,
        targetLabel: jobTitle,
        oldValue: null,
        newValue: { flagged: true, reason },
        ipAddress: ip,
        userAgent,
      })

      await createWorkItem({
        category: 'flagged_job',
        title: `Job flagged for review: ${jobTitle}`,
        description: `Reason: ${reason}. Flagged by ${session.email}.`,
        targetTable: v2Job ? 'MarketplaceJob' : 'JobPosting',
        targetId: jobId,
        severity: 'medium',
        priority: 'medium',
      })

      return NextResponse.json({ success: true, flagged: true })
    }

    if (action === 'force_refund') {
      if (!reason) {
        return NextResponse.json({ error: 'reason is required for force refund' }, { status: 400 })
      }

      const escrow = await prisma.jobEscrow.findFirst({ where: { jobId } })
      if (!escrow) {
        return NextResponse.json({ error: 'No escrow found for this job' }, { status: 404 })
      }
      if (escrow.status === 'REFUNDED') {
        return NextResponse.json({ error: 'Escrow is already refunded' }, { status: 400 })
      }
      if (escrow.status === 'RELEASED') {
        return NextResponse.json({ error: 'Escrow already released — cannot refund' }, { status: 400 })
      }

      const oldValue = { status: escrow.status, amount: Number(escrow.totalAmount) }

      await prisma.jobEscrow.update({
        where: { id: escrow.id },
        data: { status: 'REFUNDED', refundedAt: new Date() },
      })

      const newValue = { status: 'REFUNDED', amount: Number(escrow.totalAmount) }

      await createAuditLog({
        session,
        action: 'ESCROW_REFUND',
        targetTable: 'JobEscrow',
        targetId: escrow.id,
        targetLabel: `Escrow for job ${jobId}`,
        oldValue,
        newValue,
        ipAddress: ip,
        userAgent,
      })

      return NextResponse.json({ success: true, refunded: true })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (error) {
    console.error('Admin marketplace job PATCH error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
