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

    // Toggle favorite
    const existing = await prisma.propertyFavorite.findUnique({
      where: { userId_listingId: { userId: session.id, listingId: id } },
    })

    if (existing) {
      await prisma.propertyFavorite.delete({
        where: { userId_listingId: { userId: session.id, listingId: id } },
      })
      await prisma.realEstateListing.update({
        where: { id },
        data: { saves: { decrement: 1 } },
      })
      return NextResponse.json({ success: true, favorited: false })
    } else {
      await prisma.propertyFavorite.create({
        data: { userId: session.id, listingId: id },
      })
      await prisma.realEstateListing.update({
        where: { id },
        data: { saves: { increment: 1 } },
      })
      return NextResponse.json({ success: true, favorited: true })
    }
  } catch (error: any) {
    console.error('Error toggling favorite:', error)
    return NextResponse.json({ error: error?.message || 'Failed to toggle favorite' }, { status: 500 })
  }
}
