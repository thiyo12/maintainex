import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { notifyQuoteAccepted } from '@/lib/notifications'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { quoteId } = body
    if (!quoteId) return NextResponse.json({ error: 'quoteId required' }, { status: 400 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.customerId !== user.id) return NextResponse.json({ error: 'Only the customer can select a quote' }, { status: 403 })
    if (job.status !== 'OPEN') return NextResponse.json({ error: 'Job is not open' }, { status: 400 })

    const quote = await prisma.jobQuote.findUnique({ where: { id: quoteId } })
    if (!quote || quote.jobId !== job.id) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    if (quote.status !== 'PENDING') return NextResponse.json({ error: 'Quote is not available' }, { status: 400 })

    await prisma.$transaction([
      prisma.jobQuote.update({ where: { id: quoteId }, data: { status: 'ACCEPTED' } }),
      prisma.jobQuote.updateMany({ where: { jobId: job.id, id: { not: quoteId } }, data: { status: 'REJECTED' } }),
      prisma.marketplaceJob.update({ where: { id: job.id }, data: { status: 'IN_PROGRESS' } }),
      prisma.jobWorkspace.create({ data: { jobId: job.id } }),
    ])

    notifyQuoteAccepted(job.id, quote.providerId, job.title)

    return NextResponse.json({ success: true, quote })
  } catch (error) {
    console.error('Select quote error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
