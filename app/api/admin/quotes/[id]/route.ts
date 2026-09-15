import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession(request)
    if (!session || !['SUPER_ADMIN', 'FINANCE', 'MANAGER'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const quote = await prisma.jobQuote.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
      },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Fetch provider name separately (no relation on JobQuote)
    const provider = await prisma.user.findUnique({
      where: { id: quote.providerId },
      select: { id: true, name: true, email: true },
    })

    // Fetch revision chain children
    const revisions = await prisma.jobQuote.findMany({
      where: { parentQuoteId: id },
      orderBy: { revisionNumber: 'asc' },
      select: { id: true, revisionNumber: true, status: true, price: true, createdAt: true, revisionReason: true },
    })

    return NextResponse.json({ quote, provider, revisions })
  } catch (error) {
    console.error('Quote GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
