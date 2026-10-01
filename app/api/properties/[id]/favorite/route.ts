import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth/authentication/auth-utils'
import { PUBLIC_REAL_ESTATE_STATUSES } from '@/lib/real-estate/visibility'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const listing = await prisma.realEstateListing.findFirst({
      where: { id, status: { in: [...PUBLIC_REAL_ESTATE_STATUSES] } },
      select: { id: true },
    })
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "RealEstateListing" WHERE id = ${id} FOR UPDATE
      `

      const existing = await tx.propertyFavorite.findUnique({
        where: { userId_listingId: { userId: session.id, listingId: id } },
      })

      if (existing) {
        await tx.propertyFavorite.delete({
          where: { userId_listingId: { userId: session.id, listingId: id } },
        })
        await tx.realEstateListing.updateMany({
          where: { id, saves: { gt: 0 } },
          data: { saves: { decrement: 1 } },
        })
        return false
      }

      await tx.propertyFavorite.create({
        data: { userId: session.id, listingId: id },
      })
      await tx.realEstateListing.update({
        where: { id },
        data: { saves: { increment: 1 } },
      })
      return true
    })

    return NextResponse.json({ success: true, favorited: result })
  } catch (error: any) {
    console.error('Error toggling favorite:', error)
    return NextResponse.json({ error: error?.message || 'Failed to toggle favorite' }, { status: 500 })
  }
}
