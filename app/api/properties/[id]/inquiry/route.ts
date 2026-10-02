import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth/authentication/auth-utils'
import { PUBLIC_REAL_ESTATE_STATUSES } from '@/lib/real-estate/visibility'

const INQUIRY_TYPES = new Set(['chat', 'call', 'inquiry', 'viewing'])

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const type = typeof body?.type === 'string' && INQUIRY_TYPES.has(body.type)
      ? body.type
      : 'inquiry'
    const message = typeof body?.message === 'string'
      ? body.message.trim().slice(0, 2000)
      : ''

    const listing = await prisma.realEstateListing.findFirst({
      where: {
        id,
        status: { in: [...PUBLIC_REAL_ESTATE_STATUSES] },
      },
      select: { id: true, postedBy: true },
    })
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (listing.postedBy === session.id) {
      return NextResponse.json({ error: 'Cannot contact yourself' }, { status: 400 })
    }

    const result = await prisma.$transaction(async tx => {
      const inquiry = await tx.propertyInquiry.create({
        data: {
          listingId: id,
          buyerId: session.id,
          sellerId: listing.postedBy,
          type,
          message: message || null,
        },
      })

      await tx.realEstateListing.update({
        where: { id },
        data: { inquiries: { increment: 1 } },
      })

      const existingConversation = await tx.conversation.findFirst({
        where: {
          AND: [
            { participants: { some: { userId: session.id } } },
            { participants: { some: { userId: listing.postedBy } } },
          ],
        },
        select: { id: true },
      })

      let conversationId = existingConversation?.id

      if (!conversationId) {
        const conversation = await tx.conversation.create({
          data: {
            participants: {
              create: [
                { userId: session.id },
                { userId: listing.postedBy },
              ],
            },
          },
          select: { id: true },
        })
        conversationId = conversation.id
      }

      if (message && conversationId) {
        await tx.message.create({
          data: {
            conversationId,
            senderId: session.id,
            text: message,
          },
        })

        await tx.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        })
      }

      return { inquiry, conversationId }
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('Error creating inquiry:', error)
    return NextResponse.json({ error: error?.message || 'Failed to create inquiry' }, { status: 500 })
  }
}
