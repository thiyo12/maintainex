import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { notifyAllAdmins } from '@/lib/admin-notifications'
import { createWorkItem } from '@/lib/work-queue'
import { raiseJobDispute } from '@/lib/domain/job-lifecycle'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { jobId, reason, description } = await request.json()
    if (!jobId || !reason || !description) {
      return NextResponse.json({ error: 'jobId, reason, and description required' }, { status: 400 })
    }

    const marketplaceJob = await prisma.marketplaceJob.findUnique({ where: { id: jobId }, select: { id: true, title: true } })
    if (marketplaceJob) {
      await raiseJobDispute(
        { jobId, actorId: user.id, actorType: 'CUSTOMER', reason },
        jobId
      )

      await notifyAllAdmins('dispute_raised', `New Dispute: ${reason}`, `Dispute raised by ${user.name || user.email} on job "${marketplaceJob.title}"`, `/admin/marketplace/escrow`)

      await createWorkItem({
        category: 'dispute',
        title: `Dispute: ${reason}`,
        description: `${user.name || user.email} raised a dispute on job "${marketplaceJob.title}". ${description}`,
        targetTable: 'MarketplaceJob',
        targetId: jobId,
      })

      return NextResponse.json({
        id: jobId,
        jobId,
        reason,
        status: 'DISPUTED',
        createdAt: new Date().toISOString(),
      })
    }

    const job = await prisma.jobPosting.findUnique({ where: { id: jobId } })
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const dispute = await prisma.dispute.create({
      data: {
        jobId,
        raisedById: user.id,
        reason,
        description,
      },
    })

    await notifyAllAdmins('dispute_raised', `New Dispute: ${reason}`, `Dispute raised by ${user.name || user.email} on job "${job.title}"`, `/admin/marketplace/escrow`)

    await createWorkItem({
      category: 'dispute',
      title: `Dispute: ${reason}`,
      description: `${user.name || user.email} raised a dispute on job "${job.title}". ${description}`,
      targetTable: 'Dispute',
      targetId: dispute.id,
    })

    return NextResponse.json({
      id: dispute.id,
      jobId: dispute.jobId,
      reason: dispute.reason,
      status: dispute.status,
      createdAt: dispute.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('Dispute create error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const disputes = await prisma.dispute.findMany({
      where: { raisedById: user.id },
      include: {
        job: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(
      disputes.map(d => ({
        id: d.id,
        jobId: d.jobId,
        jobTitle: d.job.title,
        reason: d.reason,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
      }))
    )
  } catch (error) {
    console.error('Disputes list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
