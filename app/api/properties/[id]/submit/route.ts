import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth/authentication/auth-utils'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const listing = await prisma.realEstateListing.findUnique({ where: { id } })
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (listing.postedBy !== session.id) {
      return NextResponse.json({ error: 'Not your listing' }, { status: 403 })
    }

    if (listing.status !== 'draft' && listing.status !== 'rejected') {
      return NextResponse.json({ error: 'Listing cannot be submitted in current status' }, { status: 400 })
    }

    const updated = await prisma.realEstateListing.update({
      where: { id },
      data: {
        status: 'pending',
        rejectionReason: null,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Error submitting property:', error)
    return NextResponse.json({ error: error?.message || 'Failed to submit property' }, { status: 500 })
  }
}
