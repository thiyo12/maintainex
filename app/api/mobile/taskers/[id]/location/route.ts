import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(_request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const isCustomer = job.customerId === user.id
    const hasQuote = !!(await prisma.jobQuote.findFirst({
      where: { jobId: job.id, providerId: user.id },
    }))
    if (!isCustomer && !hasQuote) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId: job.id } })
    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: job.id } })

    const quote = await prisma.jobQuote.findFirst({
      where: { jobId: job.id, status: 'ACCEPTED' },
    })
    let location = null
    if (quote) {
      const taskerProfile = await prisma.taskerProfile.findUnique({
        where: { userId: quote.providerId },
        select: { latitude: true, longitude: true, locationUpdatedAt: true },
      })
      if (taskerProfile) {
        location = {
          providerId: quote.providerId,
          latitude: taskerProfile.latitude,
          longitude: taskerProfile.longitude,
          updatedAt: taskerProfile.locationUpdatedAt,
        }
      }
    }

    const sharing =
      workspace?.progressStatus === 'ACCEPTED' || workspace?.progressStatus === 'IN_PROGRESS'

    return NextResponse.json({
      sharing: !!location && sharing,
      location,
    })
  } catch (error) {
    console.error('Get tasker location error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}