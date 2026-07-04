import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const listing = await prisma.realEstateListing.findUnique({ where: { id: params.id } })
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (listing.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending listings can be approved' }, { status: 400 })
    }

    const updated = await prisma.realEstateListing.update({
      where: { id: params.id },
      data: {
        status: 'approved',
        reviewedBy: session.id,
        reviewedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Error approving property:', error)
    return NextResponse.json({ error: error?.message || 'Failed to approve property' }, { status: 500 })
  }
}
