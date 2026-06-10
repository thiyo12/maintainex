import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, getCountryFilter, getIp } from '@/lib/admin-rbac'
import { escrowQuerySchema } from '@/lib/admin-schemas'

export async function GET(request: NextRequest) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    const { searchParams } = request.nextUrl
    const query = escrowQuerySchema.parse({
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 25,
      status: searchParams.get('status') || undefined,
      country: searchParams.get('country') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
    })

    const where: any = {}
    if (query.status) where.status = query.status
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {}
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom)
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo)
    }

    if (session.role === 'ADMIN' && session.assignedCountries.length > 0) {
    }

    const skip = (query.page - 1) * query.limit
    const [escrows, total] = await Promise.all([
      prisma.jobEscrow.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.jobEscrow.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: escrows.map((e) => ({
        id: e.id,
        jobId: e.jobId,
        quoteId: e.quoteId,
        customerId: e.customerId,
        providerId: e.providerId,
        amount: Number(e.amount),
        serviceFee: Number(e.serviceFee),
        totalAmount: Number(e.totalAmount),
        paymentMethod: e.paymentMethod,
        status: e.status,
        heldAt: e.heldAt?.toISOString() || null,
        releasedAt: e.releasedAt?.toISOString() || null,
        refundedAt: e.refundedAt?.toISOString() || null,
        cashConfirmedAt: e.cashConfirmedAt?.toISOString() || null,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    })
  } catch (e) {
    console.error('Escrow list error:', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch escrows' }, { status: 500 })
  }
}
