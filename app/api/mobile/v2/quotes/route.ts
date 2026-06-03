import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { notifyQuoteSubmitted } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { jobId, providerType, price, estimatedCompletionTime, message, attachments } = body

    if (!jobId || !providerType || price == null) {
      return NextResponse.json({ error: 'Missing required fields: jobId, providerType, price' }, { status: 400 })
    }

    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.status !== 'OPEN') return NextResponse.json({ error: 'Job is not accepting quotes' }, { status: 400 })
    if (job.customerId === user.id) return NextResponse.json({ error: 'Cannot quote on your own job' }, { status: 400 })

    const existing = await prisma.jobQuote.findFirst({
      where: { jobId, providerId: user.id },
    })
    if (existing) return NextResponse.json({ error: 'You already submitted a quote' }, { status: 409 })

    const quote = await prisma.jobQuote.create({
      data: {
        jobId,
        providerId: user.id,
        providerType,
        price,
        estimatedCompletionTime: estimatedCompletionTime || '',
        message: message || '',
        attachments: attachments || [],
      },
    })

    notifyQuoteSubmitted(jobId, job.customerId, user.name || 'A provider')

    return NextResponse.json({ quote }, { status: 201 })
  } catch (error) {
    console.error('Create quote error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const isOwner = job.customerId === user.id
    const isQuoter = !isOwner && !!(await prisma.jobQuote.findFirst({ where: { jobId, providerId: user.id } }))
    if (!isOwner && !isQuoter) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const quotes = await prisma.jobQuote.findMany({
      where: { jobId },
      orderBy: { price: 'asc' },
    })

    const enriched = await Promise.all(
      quotes.map(async (q) => {
        const provider = await prisma.user.findUnique({
          where: { id: q.providerId },
          select: { id: true, name: true, phone: true, email: true },
        })
        let rating = 0, completedJobs = 0
        if (q.providerType === 'INDIVIDUAL') {
          const p = await prisma.taskerProfile.findUnique({
            where: { userId: q.providerId },
            select: { rating: true, completedJobs: true },
          })
          if (p) { rating = p.rating; completedJobs = p.completedJobs }
        } else {
          const p = await prisma.companyProfile.findUnique({
            where: { userId: q.providerId },
            select: { rating: true, completedProjects: true },
          })
          if (p) { rating = p.rating; completedJobs = p.completedProjects }
        }
        return { ...q, provider: provider || { id: q.providerId }, providerRating: rating, completedJobs }
      })
    )

    return NextResponse.json({ quotes: enriched })
  } catch (error) {
    console.error('Get quotes error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
