import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MODERATOR']

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const job = await prisma.marketplaceJob.findUnique({
      where: { id: params.id },
    })

    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: job })
  } catch (error) {
    console.error('Job detail error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch job' },
      { status: 500 },
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!ALLOWED_ROLES.includes(session.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { action, reason } = body

    if (action !== 'cancel') {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 },
      )
    }

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
    }

    await prisma.marketplaceJob.update({
      where: { id: params.id },
      data: { status: 'CANCELLED', isActive: false },
    })

    await prisma.auditLog.create({
      data: {
        adminUserId: session.id,
        adminEmail: session.email,
        adminRole: session.role,
        action: 'JOB_CANCEL',
        targetTable: 'MarketplaceJob',
        targetId: params.id,
        targetLabel: job.title,
        oldValue: { status: job.status, isActive: job.isActive },
        newValue: { status: 'CANCELLED', isActive: false, reason: reason || null },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Job action error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update job' },
      { status: 500 },
    )
  }
}
