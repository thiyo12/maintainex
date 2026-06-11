import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, createAuditLog, getIp } from '@/lib/admin-rbac'
import { cancelJobSchema } from '@/lib/admin-schemas'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    const job = await prisma.marketplaceJob.findUnique({
      where: { id: params.id },
    })

    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: { ...job, budgetAmount: Number(job.budgetAmount) } })
  } catch (e) {
    console.error('Job detail error:', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch job' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    const body = await request.json()
    const { reason } = cancelJobSchema.parse(body)

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
    }

    await prisma.marketplaceJob.update({
      where: { id: params.id },
      data: { status: 'CANCELLED', isActive: false },
    })

    await createAuditLog({
      session,
      action: 'JOB_CANCEL',
      targetTable: 'MarketplaceJob',
      targetId: params.id,
      targetLabel: job.title,
      oldValue: JSON.parse(JSON.stringify({ status: job.status, isActive: job.isActive })),
      newValue: JSON.parse(JSON.stringify({ status: 'CANCELLED', isActive: false, reason })),
      ipAddress: getIp(request),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Job action error:', e)
    return NextResponse.json({ success: false, error: 'Failed to update job' }, { status: 500 })
  }
}
