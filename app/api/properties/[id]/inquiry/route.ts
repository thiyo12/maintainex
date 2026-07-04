import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { type = 'inquiry', message } = body

    const listing = await prisma.realEstateListing.findUnique({ where: { id } })
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (listing.postedBy === session.id) {
      return NextResponse.json({ error: 'Cannot contact yourself' }, { status: 400 })
    }

    // Create inquiry
    const inquiry = await prisma.propertyInquiry.create({
      data: {
        listingId: id,
        buyerId: session.id,
        sellerId: listing.postedBy,
        type,
        message: message || null,
      },
    })

    // Increment inquiry count
    await prisma.realEstateListing.update({
      where: { id },
      data: { inquiries: { increment: 1 } },
    })

    // Create or find existing conversation
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: session.id } } },
          { participants: { some: { userId: listing.postedBy } } },
        ],
      },
    })

    let conversationId = existingConversation?.id

    if (!existingConversation) {
      const conversation = await prisma.conversation.create({
        data: {
          participants: {
            create: [
              { userId: session.id },
              { userId: listing.postedBy },
            ],
          },
        },
      })
      conversationId = conversation.id
    }

    // Send initial message
    if (message && conversationId) {
      await prisma.message.create({
        data: {
          conversationId,
          senderId: session.id,
          text: message,
        },
      })

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        inquiry,
        conversationId,
      },
    })
  } catch (error: any) {
    console.error('Error creating inquiry:', error)
    return NextResponse.json({ error: error?.message || 'Failed to create inquiry' }, { status: 500 })
  }
}
