import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'MANAGER', 'SUPPORT']

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const where: any = {}
    if (status && status !== 'ALL' && status !== '') where.status = status

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              budget: true,
              status: true,
            },
          },
          raisedBy: {
            select: {
              id: true,
              mxId: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.dispute.count({ where }),
    ])

    return NextResponse.json({
      disputes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Disputes GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch disputes' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const { disputeId, status, resolution } = body

    if (!disputeId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const validStatuses = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    if (status === 'RESOLVED' && !resolution?.trim()) {
      return NextResponse.json({ error: 'Resolution notes are required' }, { status: 400 })
    }

    const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } })
    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    }

    const marketplaceJob = await prisma.marketplaceJob.findUnique({
      where: { id: dispute.jobId },
      select: { id: true, status: true },
    })

    const updated = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status,
        resolution: resolution || dispute.resolution,
      },
    })

    return NextResponse.json({ dispute: updated })
  } catch (error) {
    console.error('Disputes PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update dispute' }, { status: 500 })
  }
}
