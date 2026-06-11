import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize } from '@/lib/admin-rbac'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  try {
    const [logins, audits, jobs, quotes] = await Promise.all([
      prisma.loginActivity.findMany({
        where: { userId: params.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          ipAddress: true,
          location: true,
          isSuspicious: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.findMany({
        where: {
          OR: [
            { targetTable: 'User', targetId: params.id },
            { adminEmail: (await prisma.user.findUnique({ where: { id: params.id }, select: { email: true } }))?.email },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          adminEmail: true,
          adminRole: true,
          action: true,
          targetLabel: true,
          createdAt: true,
        },
      }),
      prisma.marketplaceJob.findMany({
        where: { customerId: params.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          title: true,
          status: true,
          budgetAmount: true,
          createdAt: true,
        },
      }),
      prisma.jobQuote.findMany({
        where: { providerId: params.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          price: true,
          status: true,
          createdAt: true,
        },
      }),
    ])

    const activities: Array<{
      id: string
      type: 'LOGIN' | 'ADMIN_ACTION' | 'JOB_CREATED' | 'QUOTE_SUBMITTED'
      description: string
      timestamp: string
      metadata: Record<string, any>
    }> = []

    for (const login of logins) {
      activities.push({
        id: `login-${login.id}`,
        type: 'LOGIN',
        description: `Login from ${login.location || login.ipAddress}`,
        timestamp: login.createdAt.toISOString(),
        metadata: { ip: login.ipAddress, location: login.location, suspicious: login.isSuspicious },
      })
    }

    for (const audit of audits) {
      let label = audit.adminEmail
      if (audit.targetLabel) label = `${audit.targetLabel}`
      activities.push({
        id: `audit-${audit.id}`,
        type: 'ADMIN_ACTION',
        description: `${audit.action} by ${audit.adminEmail}${audit.targetLabel ? ` on ${audit.targetLabel}` : ''}`,
        timestamp: audit.createdAt.toISOString(),
        metadata: { action: audit.action, adminEmail: audit.adminEmail, adminRole: audit.adminRole },
      })
    }

    for (const job of jobs) {
      activities.push({
        id: `job-${job.id}`,
        type: 'JOB_CREATED',
        description: `Posted job "${job.title}" (${job.status})`,
        timestamp: job.createdAt.toISOString(),
        metadata: { jobId: job.id, title: job.title, status: job.status, budgetCents: Number(job.budgetAmount) },
      })
    }

    for (const quote of quotes) {
      activities.push({
        id: `quote-${quote.id}`,
        type: 'QUOTE_SUBMITTED',
        description: `Submitted quote (${quote.status})`,
        timestamp: quote.createdAt.toISOString(),
        metadata: { quoteId: quote.id, status: quote.status, priceCents: Number(quote.price) },
      })
    }

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({ success: true, data: activities.slice(0, 100) })
  } catch (e) {
    console.error('User activity error:', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch activity' }, { status: 500 })
  }
}
