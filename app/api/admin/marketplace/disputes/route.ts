import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, getIp } from '@/lib/admin-rbac'
import { writeAuditLog } from '@/lib/admin-audit'

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromCookie(request)
    const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN'])(session)
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const disputes = await prisma.dispute.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    const total = await prisma.dispute.count({ where: where as any })

    return NextResponse.json({ disputes, total, page, limit })
  } catch (error) {
    console.error('Disputes list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
