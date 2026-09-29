import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth/authentication/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !['SUPER_ADMIN', 'TECHNICAL', 'SUPPORT'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const emailFilter = searchParams.get('email') || undefined
    const ipFilter = searchParams.get('ip') || undefined
    const blockedOnly = searchParams.get('blocked') === 'true'

    const where: any = {}
    if (emailFilter) where.email = { contains: emailFilter, mode: 'insensitive' }
    if (ipFilter) where.ipAddress = ipFilter
    if (blockedOnly) where.blocked = true

    const [records, total, uniqueIPs, blockedCount, recentCredentialStuffs] = await Promise.all([
      prisma.failedLogin.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          ipAddress: true,
          attemptCount: true,
          blocked: true,
          blockUntil: true,
          userAgent: true,
          createdAt: true,
        },
      }),
      prisma.failedLogin.count({ where }),
      prisma.failedLogin.groupBy({ by: ['ipAddress'], where, _count: { ipAddress: true } }),
      prisma.failedLogin.count({ where: { ...where, blocked: true } }),
      prisma.failedLogin.groupBy({
        by: ['ipAddress', 'email'],
        where: {
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
        _count: { email: true },
        orderBy: { _count: { email: 'desc' } },
        take: 10,
      }),
    ])

    const ipGroups = recentCredentialStuffs.reduce<Record<string, string[]>>((acc, r) => {
      if (!acc[r.ipAddress]) acc[r.ipAddress] = []
      acc[r.ipAddress].push(r.email)
      return acc
    }, {})
    const credentialStuffs = Object.entries(ipGroups)
      .filter(([, emails]) => emails.length >= 3)
      .map(([ip, emails]) => ({ ip, emailCount: emails.length, emails }))

    return NextResponse.json({
      records: records.map((r) => ({
        id: r.id,
        email: r.email,
        ipAddress: r.ipAddress,
        attemptCount: r.attemptCount,
        blocked: r.blocked,
        blockUntil: r.blockUntil?.toISOString() || null,
        userAgent: r.userAgent,
        createdAt: r.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        uniqueIPs: uniqueIPs.length,
        blockedCount,
        credentialStuffs,
      },
    })
  } catch (error) {
    console.error('Failed logins GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch failed logins' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const email = searchParams.get('email')
    const all = searchParams.get('all') === 'true'

    if (all) {
      const deleted = await prisma.failedLogin.deleteMany({})
      return NextResponse.json({ success: true, deleted: deleted.count })
    }

    if (email) {
      const deleted = await prisma.failedLogin.deleteMany({ where: { email } })
      return NextResponse.json({ success: true, deleted: deleted.count })
    }

    if (id) {
      await prisma.failedLogin.delete({ where: { id } })
      return NextResponse.json({ success: true, deleted: 1 })
    }

    return NextResponse.json({ error: 'Provide id, email, or all=true' }, { status: 400 })
  } catch (error) {
    console.error('Failed logins DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete records' }, { status: 500 })
  }
}
