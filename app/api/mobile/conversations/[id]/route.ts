import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: params.id,
        participants: { some: { userId: user.id } },
      },
      include: {
        participants: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: conversation.id,
      jobId: conversation.jobId,
      participants: conversation.participants.map(p => ({
        id: p.user.id,
        name: p.user.name,
        email: p.user.email,
      })),
      messages: conversation.messages.map(m => ({
        id: m.id,
        senderId: m.senderId,
        text: m.text,
        read: m.read,
        createdAt: m.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Conversation get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
