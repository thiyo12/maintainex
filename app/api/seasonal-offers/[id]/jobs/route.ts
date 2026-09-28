import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth/authentication/auth-utils'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession(request)
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await prisma.seasonalOffer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Seasonal offer not found' }, { status: 404 })
    }

    const body = await request.json()
    const { jobIds } = body

    if (!Array.isArray(jobIds)) {
      return NextResponse.json({ error: 'jobIds must be an array' }, { status: 400 })
    }

    await prisma.seasonalOfferJob.deleteMany({ where: { seasonalOfferId: id } })

    if (jobIds.length > 0) {
      await prisma.seasonalOfferJob.createMany({
        data: jobIds.map((templateJobId: string) => ({
          seasonalOfferId: id,
          templateJobId,
        })),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error linking jobs:', error)
    return NextResponse.json({ error: 'Failed to link jobs' }, { status: 500 })
  }
}
