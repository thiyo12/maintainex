import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { notifyQuoteSubmitted } from '@/lib/notifications'
import { resolveCompanyContext } from '@/lib/phase6/company-context'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { jobId, providerType, price, estimatedCompletionTime, message, attachments, companyId } = body

    if (!jobId || !providerType || price == null) {
      return NextResponse.json({ error: 'Missing required fields: jobId, providerType, price' }, { status: 400 })
    }

    let resolvedProviderId = user.id
    let resolvedProviderType = providerType

    if (providerType === 'COMPANY') {
      if (!companyId) {
        return NextResponse.json({ error: 'companyId is required for company quotes' }, { status: 400 })
      }
      const { context, error } = await resolveCompanyContext(user.id, companyId, 'quotes:submit')
      if (error) return error
      resolvedProviderId = companyId
      resolvedProviderType = 'COMPANY'
    } else {
      const profile = await prisma.taskerProfile.findUnique({ where: { userId: user.id } })
      if (!profile) {
        return NextResponse.json({ error: 'You must have a provider profile to submit quotes' }, { status: 403 })
      }
    }

    if (user.identityStatus !== 'VERIFIED') {
      return NextResponse.json({ error: 'Your identity must be verified before submitting quotes.' }, { status: 403 })
    }

    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.status !== 'OPEN') return NextResponse.json({ error: 'Job is not accepting quotes' }, { status: 400 })
    if (job.customerId === user.id) return NextResponse.json({ error: 'Cannot quote on your own job' }, { status: 400 })

    const existing = await prisma.jobQuote.findFirst({
      where: { jobId, providerId: resolvedProviderId },
    })
    if (existing) return NextResponse.json({ error: 'You already submitted a quote' }, { status: 409 })

    const quote = await prisma.jobQuote.create({
      data: {
        jobId,
        providerId: resolvedProviderId,
        providerType: resolvedProviderType,
        price,
        estimatedCompletionTime: estimatedCompletionTime || '',
        message: message || '',
        attachments: JSON.stringify(attachments || []),
      },
    })

    if (job.responseState === 'awaiting') {
      await prisma.marketplaceJob.update({
        where: { id: jobId },
        data: { responseState: 'responded' },
      })
    }

    notifyQuoteSubmitted(jobId, job.customerId, user.name || 'A provider')

    return NextResponse.json({ quote: { ...quote, price: Number(quote.price) } }, { status: 201 })
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
        const providerFields = isOwner
          ? { id: true, name: true, phone: true, email: true }
          : { id: true, name: true }
        const provider = await prisma.user.findUnique({
          where: { id: q.providerId },
          select: providerFields,
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
        return { ...q, price: Number(q.price), provider: provider || { id: q.providerId }, providerRating: rating, completedJobs }
      })
    )

    return NextResponse.json({ quotes: enriched })
  } catch (error) {
    console.error('Get quotes error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
