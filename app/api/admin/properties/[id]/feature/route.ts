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

    const updated = await prisma.realEstateListing.update({
      where: { id: params.id },
      data: { isFeatured: !listing.isFeatured },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Error toggling featured:', error)
    return NextResponse.json({ error: error?.message || 'Failed to toggle featured' }, { status: 500 })
  }
}
